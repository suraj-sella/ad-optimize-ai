const BaseAgent = require("../../../agents/baseAgent");
const promptManager = require("../prompts");

class InsightGeneratorAgent extends BaseAgent {
  constructor() {
    super("InsightGeneratorAgent");
  }

  async execute(analysisData) {
    this.logger.info("InsightGeneratorAgent generating insights...");
    // Prepare prompt for LLM
    const prompt = promptManager.getTemplate("analysis");
    const input = {
      metrics: analysisData.metrics,
      patterns: analysisData.patterns,
      anomalies: analysisData.anomalies,
      topPerformers: analysisData.topPerformers,
      bottomPerformers: analysisData.bottomPerformers,
      trends: analysisData.trends,
    };
    // Call LLM for insights
    let insights = [];
    let aiGenerated = true;
    try {
      if (this.llm && prompt) {
        const chain = prompt.pipe(this.llm);
        const result = await chain.invoke({ data: JSON.stringify(input) });
        // Ensure output is always JSON
        try {
          if (typeof result === "string") {
            insights = JSON.parse(result);
          } else {
            insights = result;
          }
        } catch (e) {
          // If not JSON, wrap in a JSON object
          insights = [
            {
              message:
                typeof result === "string" ? result : JSON.stringify(result),
            },
          ];
        }
      } else {
        insights = [{ message: "LLM or prompt not available" }];
        aiGenerated = false;
      }
    } catch (err) {
      this.logger.error("LLM call failed:", err);
      insights = [{ message: "Failed to generate insights via LLM" }];
      aiGenerated = false;
    }
    return {
      insights,
      aiGenerated,
    };
  }
}

module.exports = InsightGeneratorAgent;
