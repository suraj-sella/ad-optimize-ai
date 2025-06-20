const { PromptTemplate } = require("@langchain/core/prompts");
const logger = require("../../utils/logger");

class PromptManager {
  constructor() {
    this.templates = {};
    this.initializeTemplates();
  }

  initializeTemplates() {
    try {
      // Basic analysis prompt
      this.templates.analysis = PromptTemplate.fromTemplate(`
        Analyze the following advertising data and provide insights:
        {data}
        
        Please focus on:
        1. Key performance metrics
        2. Notable trends
        3. Potential areas for improvement
        4. Recommendations
        
        Format your response as a structured JSON object.
      `);

      // Basic optimization prompt
      this.templates.optimization = PromptTemplate.fromTemplate(`
        Based on the following analysis, generate optimization recommendations:
        {analysis}
        
        Please provide:
        1. Specific actions to take
        2. Expected impact
        3. Priority level
        4. Implementation difficulty
        
        Format your response as a JSON array of 5 items. Each array element should be an object with the following fields: recommendation, impact, priority, and difficulty. Do not wrap the array in an outer object.
      `);

      logger.info("Prompt templates initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize prompt templates:", error);
      throw error;
    }
  }

  getTemplate(name) {
    if (!this.templates[name]) {
      throw new Error(`Template '${name}' not found`);
    }
    return this.templates[name];
  }
}

// Export singleton instance
module.exports = new PromptManager();
