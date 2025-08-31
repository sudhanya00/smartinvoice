/* global BigInt, BigInt64Array */
import * as ort from 'onnxruntime-web';
import localforage from 'localforage';
import { encode, decode } from './tokenizer';
import { OFFLINE_MODEL_URL, OFFLINE_MODEL_CACHE_KEY, MAX_LOCAL_INPUT_LENGTH } from '../constants';

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
      
      // Try to load model from cache first
      const modelData = await this.modelStorage.getItem(OFFLINE_MODEL_CACHE_KEY);

      if (modelData) {
        // Create session from cached model
        this.session = await ort.InferenceSession.create(modelData, options);
        this.isModelReady = true;
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to initialize ONNX runtime:', error);
      return false;
    }
  }

  /**
   * Download and cache the model
   * @param {Function} progressCallback - Callback for download progress
   * @returns {Promise<boolean>} - Whether download was successful
   */
  async downloadModel(progressCallback) {
    try {
      const response = await fetch(this.modelUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentLength = response.headers.get('content-length');
      const total = parseInt(contentLength, 10);
      
      let loaded = 0;
      const chunks = [];
      
      const reader = response.body.getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        loaded += value.length;
        
        if (progressCallback && total) {
          progressCallback(Math.round((loaded / total) * 100));
        }
      }
      
      // Concatenate chunks into a single Uint8Array
      const modelSize = chunks.reduce((acc, val) => acc + val.length, 0);
      const modelData = new Uint8Array(modelSize);
      let position = 0;
      
      for (const chunk of chunks) {
        modelData.set(chunk, position);
        position += chunk.length;
      }
      
      // Cache the model data
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
      
      this.session = await ort.InferenceSession.create(modelData, options);
      this.isModelReady = true;
      
      return true;
    } catch (error) {
      console.error('Model download failed:', error);
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
