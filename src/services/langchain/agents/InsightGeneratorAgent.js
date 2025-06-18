const BaseAgent = require('../../../agents/baseAgent');
const promptManager = require('../prompts');

class InsightGeneratorAgent extends BaseAgent {
  constructor() {
    super('InsightGeneratorAgent');
  }

  async execute(analysisData) {
    this.logger.info('InsightGeneratorAgent generating insights...');
    // Prepare prompt for LLM
    const prompt = promptManager.getTemplate('analysis');
    const input = {
      metrics: analysisData.metrics,
      patterns: analysisData.patterns,
      anomalies: analysisData.anomalies
    };
    // Call LLM for insights
    let insights = [];
    let aiGenerated = true;
    try {
      if (this.llm && prompt) {
        const chain = prompt.pipe(this.llm);
        const result = await chain.invoke({ data: JSON.stringify(input) });
        // Try to parse as JSON, fallback to string
        try {
          insights = typeof result === 'string' ? JSON.parse(result) : result;
        } catch (e) {
          insights = [result];
        }
      } else {
        insights = ['LLM or prompt not available'];
        aiGenerated = false;
      }
    } catch (err) {
      this.logger.error('LLM call failed:', err);
      insights = ['Failed to generate insights via LLM'];
      aiGenerated = false;
    }
    return {
      insights,
      raw: analysisData,
      aiGenerated
    };
  }
}

module.exports = InsightGeneratorAgent; 