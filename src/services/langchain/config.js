const { ChatHuggingFace } = require('@langchain/community/chat_models/huggingface');
const { HfInference } = require('@huggingface/inference');
const { logger } = require('../../utils/logger');

class LangChainConfig {
    constructor() {
        this.model = null;
        this.initialized = false;
    }

    async initialize() {
        try {
            // Initialize HuggingFace client
            const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

            // Initialize the chat model
            this.model = new ChatHuggingFace({
                model: "mistralai/Mistral-7B-Instruct-v0.2", // Using Mistral as it's a good open-source model
                temperature: 0.7,
                maxTokens: 1000,
                huggingFaceApiKey: process.env.HUGGINGFACE_API_KEY
            });

            this.initialized = true;
            logger.info('LangChain configuration initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize LangChain configuration:', error);
            throw error;
        }
    }

    getModel() {
        if (!this.initialized) {
            throw new Error('LangChain configuration not initialized');
        }
        return this.model;
    }
}

module.exports = new LangChainConfig(); 