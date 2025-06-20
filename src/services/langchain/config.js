const logger = require("../../utils/logger");

class LangChainConfig {
  constructor() {
    this.model = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      // Alternative approach using HuggingFace Inference API directly
      const { HfInference } = await import("@huggingface/inference");

      // Initialize HuggingFace client
      this.hfClient = new HfInference(process.env.HUGGINGFACE_API_KEY);

      // Create a wrapper that mimics LangChain's interface
      this.model = {
        invoke: async (messages) => {
          try {
            // Convert LangChain message format to HF format
            let prompt = "";
            if (Array.isArray(messages)) {
              prompt = messages
                .map((msg) => {
                  if (typeof msg === "string") return msg;
                  return msg.content || msg.text || String(msg);
                })
                .join("\n");
            } else {
              prompt = messages.content || messages.text || String(messages);
            }

            const response = await this.hfClient.textGeneration({
              model: "mistralai/Mistral-7B-Instruct-v0.3",
              inputs: prompt,
              parameters: {
                max_new_tokens: 1000,
                temperature: 0.7,
                return_full_text: false,
              },
            });

            // Return in LangChain-compatible format
            return {
              content: response.generated_text,
              text: response.generated_text,
            };
          } catch (error) {
            logger.error("Error in model invocation:", error);
            throw error;
          }
        },

        // Alternative method name that some LangChain versions use
        call: async (messages) => {
          return this.invoke(messages);
        },
      };

      this.initialized = true;
      logger.info(
        "LangChain configuration initialized successfully with HF direct API"
      );
    } catch (error) {
      logger.error("Failed to initialize LangChain configuration:", error);
      throw error;
    }
  }

  getModel() {
    if (!this.initialized) {
      throw new Error("LangChain configuration not initialized");
    }
    return this.model;
  }
}

module.exports = new LangChainConfig();
