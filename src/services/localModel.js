/* global BigInt, BigInt64Array */
import * as ort from 'onnxruntime-web';
import localforage from 'localforage';
import { encode, decode } from './tokenizer';
import { 
  OFFLINE_MODEL_URL, 
  OFFLINE_MODEL_CACHE_KEY, 
  MAX_LOCAL_INPUT_LENGTH, 
  OFFLINE_MODEL_CORS_PROXY,
  OFFLINE_MODEL_FALLBACK_URL 
} from '../constants';

// Polyfill for BigInt in older browsers if needed
// This is just a check - actual polyfilling would need a proper library
if (typeof BigInt === 'undefined') {
  console.warn('BigInt is not supported in this browser. Some features may not work correctly.');
}

/**
 * Service for managing and running the local Gemma 2B model
 */
class LocalModelService {
  constructor() {
    this.modelUrl = OFFLINE_MODEL_URL;
    this.fallbackUrl = OFFLINE_MODEL_FALLBACK_URL;
    this.corsProxy = OFFLINE_MODEL_CORS_PROXY;
    this.session = null;
    this.isModelReady = false;
    this.maxTokens = MAX_LOCAL_INPUT_LENGTH;
    this.maxLength = 512;
    this.temperature = 0.7;
    this.topP = 0.9;
    this.stopTokens = [2, 128009]; // EOS token and period
    
    console.log('LocalModelService constructed, ready state:', this.isModelReady);

    // Create a separate localforage instance for model storage
    this.modelStorage = localforage.createInstance({
      name: 'modelCache',
      storeName: 'models'
    });
    
    // Listen for service worker model download events
    this._setupServiceWorkerListener();
  }
  
  /**
   * Set up listener for service worker model download events
   * @private
   */
  _setupServiceWorkerListener() {
    if ('serviceWorker' in navigator) {
      const handleModelDownloadStatus = (event) => {
        const { status } = event.detail;
        
        if (status === 'success' || status === 'cached') {
          console.log('Service worker reports model download success');
          
          // After successful download by service worker, try to load it
          setTimeout(async () => {
            if (!this.isModelReady) {
              console.log('Trying to initialize model after service worker download');
              await this.init();
            }
          }, 1000);
        }
      };
      
      // Add event listener
      window.addEventListener('modelDownloadStatus', handleModelDownloadStatus);
    }
  }
  
  /**
   * Update the model ready state
   * @param {boolean} isReady - Whether the model is ready
   */
  setModelReady(isReady) {
    console.log('LocalModelService: Setting model ready state to:', isReady);
    this.isModelReady = isReady;
  }

  /**
   * Initialize the ONNX runtime
   */
  async init() {
    if (this.session) return true;

    try {
      // Set execution providers
      const options = {
        executionProviders: ['wasm']
      };

      if (navigator.gpu) {
        // Use WebGPU if available
        options.executionProviders = ['webgpu', 'wasm'];
      } else if (navigator.ml?.getGPUSupport?.()) {
        // Use WebNN if available as fallback
        options.executionProviders = ['webnn', 'wasm'];
      }
      
      // Try to load model from local storage cache first
      const modelData = await this.modelStorage.getItem(OFFLINE_MODEL_CACHE_KEY);

      if (modelData) {
        console.log('Model found in local storage cache');
        // Create session from cached model
        this.session = await ort.InferenceSession.create(modelData, options);
        this.isModelReady = true;
        return true;
      }
      
      // Check if the model is in service worker cache
      const isInServiceWorkerCache = await this.checkServiceWorkerCache();
      if (isInServiceWorkerCache) {
        console.log('Model found in service worker cache, fetching');
        
        try {
          // Fetch the model from service worker cache
          const response = await fetch(this.fallbackUrl);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          // Convert response to array buffer
          const arrayBuffer = await response.arrayBuffer();
          const modelData = new Uint8Array(arrayBuffer);
          
          // Cache the model data in local storage
          await this.modelStorage.setItem(OFFLINE_MODEL_CACHE_KEY, modelData);
          await localforage.setItem('modelDownloaded', true);
          
          // Create session from model data
          this.session = await ort.InferenceSession.create(modelData, options);
          this.isModelReady = true;
          return true;
        } catch (error) {
          console.error('Failed to load model from service worker cache:', error);
        }
      }
      
      return false;
    } catch (error) {
      console.error('Failed to initialize ONNX runtime:', error);
      return false;
    }
  }

  /**
   * Download and cache the model
   * @param {Function} progressCallback - Callback for download progress updates
   * @returns {Promise<Object>} - Result object with success status and error info
   */
  async downloadModel(progressCallback) {
    // First check if we're online
    if (!navigator.onLine) {
      console.error('Device is offline, cannot download model');
      progressCallback?.(-1); // Use -1 to indicate an error
      return { success: false, error: 'network-offline' };
    }
    
    // Define all URLs to try in order
    const urlsToTry = [
      this.modelUrl,
      this.fallbackUrl,
      this.corsProxy + encodeURIComponent(this.modelUrl),
      this.corsProxy + encodeURIComponent(this.fallbackUrl),
      import('../constants').then(constants => constants.OFFLINE_MODEL_THIRD_SOURCE)
    ];
    
    let lastError = null;
    
    // Try each URL in sequence
    for (let i = 0; i < urlsToTry.length; i++) {
      try {
        const url = await Promise.resolve(urlsToTry[i]);
        console.log(`Trying URL ${i+1}/${urlsToTry.length}: ${url}`);
        progressCallback?.(0); // Reset progress for this attempt
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for larger file
        
        const response = await fetch(url, {
          signal: controller.signal,
          credentials: 'omit', // Don't send cookies
          cache: 'force-cache', // Try to use cache if available
          headers: {
            'Accept': 'application/octet-stream',
            'X-Requested-With': 'XMLHttpRequest'
          },
          mode: 'cors'
        });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const contentLength = response.headers.get('content-length');
      const total = parseInt(contentLength, 10) || 0;
      
      let loaded = 0;
      const chunks = [];
      
      // Set up progress tracking
      const reader = response.body.getReader();
      let lastProgressTime = Date.now();
      
      // Set up a watchdog to detect stalled downloads
      const watchdogInterval = setInterval(() => {
        if (Date.now() - lastProgressTime > 30000) { // 30 seconds with no progress
          clearInterval(watchdogInterval);
          controller.abort();
          console.error('Download stalled');
        }
      }, 10000);
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          chunks.push(value);
          loaded += value.length;
          lastProgressTime = Date.now(); // Update last progress time
          
          if (progressCallback && total) {
            progressCallback(Math.round((loaded / total) * 100));
          } else if (progressCallback) {
            // If we don't know total size, just indicate activity
            progressCallback(-1);
          }
        }
        
        clearInterval(watchdogInterval);
        
        // Concatenate chunks into a single Uint8Array
        const modelSize = chunks.reduce((acc, val) => acc + val.length, 0);
        const modelData = new Uint8Array(modelSize);
        let position = 0;
        
        for (const chunk of chunks) {
          modelData.set(chunk, position);
          position += chunk.length;
        }
        
        // Cache the model data
        console.log(`Model download complete, size: ${modelSize} bytes`);
        await this.modelStorage.setItem(OFFLINE_MODEL_CACHE_KEY, modelData);
        await localforage.setItem('modelDownloaded', true);
        
        // Initialize the model session
        const options = {
          executionProviders: ['wasm']
        };
        
        if (navigator.gpu) {
          options.executionProviders = ['webgpu', 'wasm'];
        } else if (navigator.ml?.getGPUSupport?.()) {
          options.executionProviders = ['webnn', 'wasm'];
        }
        
        console.log('Creating ONNX session with model data');
        this.session = await ort.InferenceSession.create(modelData, options);
        this.isModelReady = true;
        
        console.log('Model successfully loaded and initialized');
        return { success: true };
      } catch (readError) {
        clearInterval(watchdogInterval);
        throw readError;
      }
        
        // If we reach here, download was successful - exit the loop
        return { success: true };
      } catch (error) {
        console.error(`Attempt ${i+1} failed:`, error);
        lastError = error;
        // Continue to next URL
      }
    }
    
    // If we get here, all attempts failed
    console.error('All model download attempts failed');
    return { 
      success: false, 
      error: lastError?.name === 'AbortError' ? 'timeout' : 'network',
      details: lastError?.message || 'All download attempts failed'
    };
  }

  /**
   * Check if the model is already in the service worker cache
   * @returns {Promise<boolean>} - Whether the model is in cache
   */
  async checkServiceWorkerCache() {
    try {
      // Only try if service worker is available
      if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
        return false;
      }
      
      return new Promise((resolve) => {
        // Create a message channel for the service worker to respond through
        const messageChannel = new MessageChannel();
        
        // Set up response handler
        messageChannel.port1.onmessage = (event) => {
          resolve(event.data.isModelCached);
        };
        
        // Ask service worker to check the cache
        navigator.serviceWorker.controller.postMessage({
          action: 'checkModelCache',
          modelUrl: this.modelUrl
        }, [messageChannel.port2]);
        
        // Set a timeout in case service worker doesn't respond
        setTimeout(() => resolve(false), 1000);
      });
    } catch (error) {
      console.error('Error checking service worker cache:', error);
      return false;
    }
  }

  /**
   * Generate text with the local model
   * @param {string} prompt - Input text prompt
   * @returns {Promise<string>} - Generated text response
   */
  async generate(prompt) {
    if (!this.isModelReady || !this.session) {
      throw new Error('Model is not ready. Please initialize it first.');
    }

    try {
      // This is a simplified implementation
      console.log('Generating response with local model for prompt:', prompt.substring(0, 50) + '...');
      
      // Encode the input text to tokens
      const inputTokens = await encode(prompt);
      
      // Truncate tokens if too long
      const truncatedTokens = inputTokens.slice(0, this.maxTokens);
      
      // Create tensor input for the model
      const inputTensor = new ort.Tensor('int64', new BigInt64Array(truncatedTokens.map(BigInt)), [1, truncatedTokens.length]);
      
      // Run model inference
      const outputMap = await this.session.run({
        'input_ids': inputTensor
      });
      
      // Extract generated tokens
      const outputTensor = outputMap['output_ids'];
      const generatedTokens = Array.from(outputTensor.data).map(Number);
      
      // Decode tokens to text
      const response = await decode(generatedTokens);
      
      return response.trim();
    } catch (error) {
      console.error('Error generating text with local model:', error);
      return 'Sorry, there was an error processing your request locally.';
    }
  }
}

// Export singleton instance
const localModelService = new LocalModelService();
export default localModelService;
