const BaseAgent = require("../../../agents/baseAgent");

class DataAnalyzerAgent extends BaseAgent {
  constructor() {
    super("DataAnalyzerAgent");
  }

  async execute(data) {
    this.logger.info("DataAnalyzerAgent analyzing data...");
    // Calculate metrics
    const metrics = this.calculateMetrics(data);
    // Identify patterns and anomalies
    const patterns = this.identifyPatterns(data);
    const anomalies = this.identifyAnomalies(data);
    // Identify top/bottom performers
    const topPerformers = this.identifyTopPerformers(data);
    const bottomPerformers = this.identifyBottomPerformers(data);
    // Analyze trends
    const trends = this.analyzeTrends(data);
    return {
      metrics,
      patterns,
      anomalies,
      topPerformers,
      bottomPerformers,
      trends,
    };
  }

  calculateMetrics(data) {
    // Example: calculate totals and averages for impressions, clicks, cost, etc.
    const summary = {
      totalImpressions: 0,
      totalClicks: 0,
      totalCost: 0,
      totalSales: 0,
      totalConversions: 0,
      averageCTR: 0,
      averageCPC: 0,
      averageROAS: 0,
      averageACOS: 0,
      rowCount: 0,
    };
    let validCTR = 0,
      validCPC = 0,
      validROAS = 0,
      validACOS = 0;
    (data.rows || data).forEach((row) => {
      summary.totalImpressions += row.impressions || 0;
      summary.totalClicks += row.clicks || 0;
      summary.totalCost += row.cost || 0;
      summary.totalSales += row.sales || 0;
      summary.totalConversions += row.conversions || 0;
      if (row.calculated_ctr) {
        summary.averageCTR += row.calculated_ctr;
        validCTR++;
      }
      if (row.calculated_cpc) {
        summary.averageCPC += row.calculated_cpc;
        validCPC++;
      }
      if (row.calculated_roas) {
        summary.averageROAS += row.calculated_roas;
        validROAS++;
      }
      if (row.calculated_acos) {
        summary.averageACOS += row.calculated_acos;
        validACOS++;
      }
      summary.rowCount++;
    });
    if (validCTR > 0) summary.averageCTR /= validCTR;
    if (validCPC > 0) summary.averageCPC /= validCPC;
    if (validROAS > 0) summary.averageROAS /= validROAS;
    if (validACOS > 0) summary.averageACOS /= validACOS;
    return summary;
  }

  identifyPatterns(data) {
    // Example: find keywords with high CTR or high ROAS
    const rows = data.rows || data;
    const highCTR = rows.filter(
      (row) => row.calculated_ctr && row.calculated_ctr > 10
    );
    const highROAS = rows.filter(
      (row) => row.calculated_roas && row.calculated_roas > 3
    );
    return [
      {
        type: "high_ctr",
        count: highCTR.length,
        keywords: highCTR.map((r) => r.keyword),
      },
      {
        type: "high_roas",
        count: highROAS.length,
        keywords: highROAS.map((r) => r.keyword),
      },
    ];
  }

  identifyAnomalies(data) {
    // Example: find rows with zero conversions or very high ACOS
    const rows = data.rows || data;
    const zeroConversions = rows.filter(
      (row) => row.conversions === 0 || !row.conversions
    );
    const highACOS = rows.filter(
      (row) => row.calculated_acos && row.calculated_acos > 50
    );
    return [
      {
        type: "zero_conversions",
        count: zeroConversions.length,
        keywords: zeroConversions.map((r) => r.keyword),
      },
      {
        type: "high_acos",
        count: highACOS.length,
        keywords: highACOS.map((r) => r.keyword),
      },
    ];
  }

  identifyTopPerformers(data) {
    const rows = data.rows || data;
    return {
      byROAS: rows
        .filter((r) => r.calculated_roas)
        .sort((a, b) => b.calculated_roas - a.calculated_roas)
        .slice(0, 5),
      byCTR: rows
        .filter((r) => r.calculated_ctr)
        .sort((a, b) => b.calculated_ctr - a.calculated_ctr)
        .slice(0, 5),
      bySales: rows
        .filter((r) => r.sales)
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5),
    };
  }

  identifyBottomPerformers(data) {
    const rows = data.rows || data;
    return {
      byROAS: rows
        .filter((r) => r.calculated_roas)
        .sort((a, b) => a.calculated_roas - b.calculated_roas)
        .slice(0, 5),
      byCTR: rows
        .filter((r) => r.calculated_ctr)
        .sort((a, b) => a.calculated_ctr - b.calculated_ctr)
        .slice(0, 5),
      byACOS: rows
        .filter((r) => r.calculated_acos)
        .sort((a, b) => b.calculated_acos - a.calculated_acos)
        .slice(0, 5),
    };
  }

  analyzeTrends(data) {
    const rows = data.rows || data;
    return {
      highCostKeywords: rows.filter((r) => r.cost > 100).length,
      lowCTRKeywords: rows.filter((r) => r.calculated_ctr < 1).length,
      highACOSKeywords: rows.filter((r) => r.calculated_acos > 50).length,
      zeroConversionKeywords: rows.filter(
        (r) => !r.conversions || r.conversions === 0
      ).length,
    };
  }
}

module.exports = DataAnalyzerAgent;
