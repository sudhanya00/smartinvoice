# Smart Invoice Offline Mode Setup

## Overview

The Smart Invoice application now supports an "Offline Mode" feature that processes AI-based text tasks on the user's device using a local language model. This document provides technical details about the implementation and how to maintain it.

## Key Components

1. **Local Model Processing**
   - Uses Gemma 2B (quantized to 4-bit)
   - ONNX format for cross-platform compatibility
   - WebAssembly and WebGPU acceleration when available

2. **Service Worker**
   - Caches application shell assets for offline use
   - Handles model file caching separately
   - Provides progressive web app capabilities

3. **IndexedDB Storage**
   - Uses localforage library for simplified IndexedDB access
   - Stores the downloaded model (~10-15MB)
   - Caches offline-processed data for later synchronization

4. **Context Management**
   - React context for global offline mode state
   - Persists user preference in localStorage
   - Manages model download and initialization flow

## Model Details

- **Model**: Gemma 2B
- **Size**: ~10-15MB (quantized to 4-bit)
- **Source**: Hugging Face - TheBloke/gemma-2b-GGUF
- **Format**: ONNX (.onnx)
- **Performance**: 
  - First inference: 1-3 seconds
  - Subsequent inferences: <1 second
  - Memory usage: ~100-150MB during operation

## Implementation Notes

### Model Loading Flow

1. User toggles "Offline Mode" in settings
2. Application checks if model exists in IndexedDB
3. If not present, download starts with progress indicator
4. Once downloaded, model is cached for future use
5. ONNX session is created with appropriate backend (WebGPU > WebNN > WASM)
6. Offline indicator appears in UI when model is ready

### Request Handling Logic

This is exactly how our implementation routes requests in the `gemini.js` service:

```javascript
async callAPI(payload, setNotification) {
  try {
    // Check if we should use local model
    if (this.isOfflineMode && LocalModelService.isModelReady) {
      return await this.generateWithLocalModel(payload);
    }
    
    // Otherwise use online API
    if (!this.apiKey) {
      throw new Error("Gemini API Key not found.");
    }

    const apiUrl = `${this.baseUrl}?key=${this.apiKey}`;
    // ... online API request handling
  } catch (error) {
    // If online API fails and we have the local model ready, fall back to it
    if (!this.isOfflineMode && LocalModelService.isModelReady) {
      setNotification?.({ 
        text: `Online API unavailable. Falling back to local model.`, 
        type: 'warning' 
      });
      return await this.generateWithLocalModel(payload);
    }
    
    // ... error handling
  }
}
```

### Error Handling Strategy

- Failures in local processing attempt to fall back to online API
- Network errors trigger fallback to local model if available
- User is notified when image tasks require online mode

## Maintenance Guide

### Model Updates

To update the model to a newer version:

1. Update the model URL in `localModel.js`
2. Increment the cache version in `service-worker.js`
3. Test thoroughly with both online and offline modes

### Adding New AI Features

When adding new AI capabilities:

1. Implement the online version first using Gemini API
2. Add conditional logic to check for offline mode
3. Implement a simplified version for the local model
4. Handle graceful degradation for unsupported features

### Memory Management

The local model consumes significant memory. Consider:

1. Unloading the model when not in use for extended periods
2. Monitoring for memory warnings and releasing resources
3. Allowing user configuration of model size/quality trade-offs

## Performance Optimizations

- The model is loaded only when needed
- Service worker caches application assets for fast loading
- IndexedDB efficiently stores the model between sessions
- WebGPU acceleration is used when available

## Future Enhancements

- Support for smaller models for low-end devices
- Better temperature/top-p sampling for higher quality responses
- Improved tokenization with full vocabulary
- Model selection options (size vs. quality trade-offs)
- Background synchronization for offline-generated data

## Testing Guidelines

Always test these scenarios:
- First-time download experience
- Returning user with cached model
- Toggle between online/offline modes
- Performance on various device capabilities
- Behavior when network is unavailable
