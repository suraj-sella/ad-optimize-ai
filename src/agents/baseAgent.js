const langchainConfig = require('../services/langchain/config');
const promptManager = require('../services/langchain/prompts');
const logger = require('../utils/logger');

class BaseAgent {
  constructor(agentName) {
    this.agentName = agentName;
    this.llm = langchainConfig.getModel();
    this.logger = logger;
  }

  async execute(promptName, data) {
    try {
      const prompt = promptManager.getTemplate(promptName);
      const chain = prompt.pipe(this.llm);
      
      this.logger.info(`${this.agentName} executing prompt: ${promptName}`);
      const result = await chain.invoke({ data: JSON.stringify(data) });
      
      this.logger.info(`${this.agentName} completed execution successfully`);
      return this.parseResponse(result);
    } catch (error) {
      this.logger.error(`${this.agentName} execution failed:`, error);
      throw error;
    }
  }

  parseResponse(response) {
    try {
      // Attempt to parse JSON response
      if (typeof response === 'string') {
        return JSON.parse(response);
      }
      return response;
    } catch (error) {
      this.logger.warn(`${this.agentName} failed to parse response as JSON:`, error);
      return response;
    }
  }

  validateInput(data) {
    if (!data) {
      throw new Error('Input data is required');
    }
    return true;
  }
}

module.exports = BaseAgent; 