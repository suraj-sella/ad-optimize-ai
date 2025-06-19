const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class CSVProcessor {
  constructor() {
    this.supportedColumns = [
      'keyword',
      'search_term',
      'impressions',
      'clicks',
      'cost',
      'sales',
      'conversions',
      'acos',
      'roas',
      'ctr',
      'cpc',
      'cpm',
      'product_targets',
      'added_as',
      'orders'
    ];

    // Define a mapping for inconsistent CSV headers to internal field names
    this.headerMap = {
      'matched product': 'keyword',
      'spend(usd)': 'cost',
      'sales(usd)': 'sales',
      'cpc(usd)': 'cpc',
      'conversion rate': 'conversions'
    };
  }

  /**
   * Process CSV file and extract data with validation
   */
  async processCSV(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      let rowCount = 0;
      let headers = null;

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('headers', (headerList) => {
          headers = headerList;
          logger.info(`CSV headers detected: ${headerList.join(', ')}`);
        })
        .on('data', (data) => {
          rowCount++;
          const validatedRow = this.validateAndCleanRow(data, rowCount);
          if (validatedRow) {
            results.push(validatedRow);
          }
        })
        .on('end', () => {
          logger.info(`CSV processing completed. Processed ${rowCount} rows, ${results.length} valid rows`);
          resolve({
            data: results,
            totalRows: rowCount,
            validRows: results.length,
            headers: headers
          });
        })
        .on('error', (error) => {
          logger.error('Error processing CSV file:', error);
          reject(error);
        });
    });
  }

  /**
   * Validate and clean individual row data (advanced validation)
   */
  validateAndCleanRow(row, rowNumber) {
    try {
      const cleanedRow = {};
      const numericFields = [
        'impressions', 'clicks', 'cost', 'sales', 'conversions',
        'acos', 'roas', 'ctr', 'cpc', 'cpm', 'orders'
      ];
      // Clean and validate each field
      for (const [key, value] of Object.entries(row)) {
        let normalizedKey = key.trim().toLowerCase();
        // Apply specific header mapping
        if (this.headerMap[normalizedKey]) {
          normalizedKey = this.headerMap[normalizedKey];
        } else {
          normalizedKey = normalizedKey.replace(/\s+/g, '_');
        }
        if (this.supportedColumns.includes(normalizedKey)) {
          cleanedRow[normalizedKey] = this.cleanValue(value);
        } else {
          logger.warn(`Row ${rowNumber}: Column '${key}' (normalized to '${normalizedKey}') is not a supported column and will be ignored.`);
        }
      }
      // Set missing non-required numeric fields to 0
      for (const field of numericFields) {
        if (!(field in cleanedRow) || cleanedRow[field] === null || cleanedRow[field] === undefined || cleanedRow[field] === '') {
          cleanedRow[field] = 0;
        }
      }
      // Validate required fields
      if (!this.hasRequiredFields(cleanedRow)) {
        logger.warn(`Row ${rowNumber}: Missing required fields`);
        return null;
      }
      // Advanced integrity checks
      // 1. All numeric fields must be non-negative
      for (const field of numericFields) {
        if (typeof cleanedRow[field] === 'number' && cleanedRow[field] < 0) {
          logger.warn(`Row ${rowNumber}: Field '${field}' has negative value (${cleanedRow[field]}). Row skipped.`);
          return null;
        }
      }
      // 2. Logical consistency: impressions >= clicks
      if (cleanedRow.impressions < cleanedRow.clicks) {
        logger.warn(`Row ${rowNumber}: Clicks (${cleanedRow.clicks}) exceed impressions (${cleanedRow.impressions}). Row skipped.`);
        return null;
      }
      // 3. Outlier detection (optional, simple):
      // If impressions or clicks are extremely high, flag as outlier (e.g., > 1,000,000)
      if (cleanedRow.impressions > 1_000_000 || cleanedRow.clicks > 1_000_000) {
        logger.warn(`Row ${rowNumber}: Impressions or clicks are extremely high (impressions: ${cleanedRow.impressions}, clicks: ${cleanedRow.clicks}). Row skipped as outlier.`);
        return null;
      }
      // Calculate additional metrics
      const enrichedRow = this.calculateMetrics(cleanedRow);
      return enrichedRow;
    } catch (error) {
      logger.error(`Error processing row ${rowNumber}:`, error);
      return null;
    }
  }

  /**
   * Clean and convert value to appropriate type
   */
  cleanValue(value) {
    if (!value || value === '') return null;
    
    const cleaned = value.toString().trim();
    
    // Try to convert to number if it looks like a number
    if (!isNaN(cleaned) && cleaned !== '') {
      return parseFloat(cleaned);
    }
    
    return cleaned;
  }

  /**
   * Check if row has required fields
   */
  hasRequiredFields(row) {
    const requiredFields = ['keyword', 'impressions', 'clicks', 'cost'];
    return requiredFields.every(field => row[field] !== null && row[field] !== undefined);
  }

  /**
   * Calculate additional metrics for the row
   */
  calculateMetrics(row) {
    const metrics = { ...row };

    // Calculate CTR (Click-Through Rate)
    if (metrics.impressions && metrics.clicks) {
      metrics.calculated_ctr = (metrics.clicks / metrics.impressions) * 100;
    }

    // Calculate CPC (Cost Per Click)
    if (metrics.cost && metrics.clicks) {
      metrics.calculated_cpc = metrics.cost / metrics.clicks;
    }

    // Calculate CPM (Cost Per Mille)
    if (metrics.cost && metrics.impressions) {
      metrics.calculated_cpm = (metrics.cost / metrics.impressions) * 1000;
    }

    // Calculate ROAS (Return on Ad Spend)
    if (metrics.sales && metrics.cost) {
      metrics.calculated_roas = metrics.sales / metrics.cost;
    }

    // Calculate ACOS (Advertising Cost of Sale)
    if (metrics.cost && metrics.sales) {
      metrics.calculated_acos = (metrics.cost / metrics.sales) * 100;
    }

    // Calculate Conversion Rate
    if (metrics.clicks && metrics.conversions) {
      metrics.calculated_conversion_rate = (metrics.conversions / metrics.clicks) * 100;
    }

    return metrics;
  }

  /**
   * Generate comprehensive analysis from processed data
   */
  generateAnalysis(processedData) {
    const analysis = {
      summary: this.generateSummary(processedData),
      topPerformers: this.identifyTopPerformers(processedData),
      bottomPerformers: this.identifyBottomPerformers(processedData),
      trends: this.analyzeTrends(processedData),
      recommendations: this.generateRecommendations(processedData)
    };

    return analysis;
  }

  /**
   * Generate summary statistics
   */
  generateSummary(data) {
    const summary = {
      totalKeywords: data.length,
      totalImpressions: 0,
      totalClicks: 0,
      totalCost: 0,
      totalSales: 0,
      totalConversions: 0,
      averageCTR: 0,
      averageCPC: 0,
      averageROAS: 0,
      averageACOS: 0
    };

    let validCTR = 0, validCPC = 0, validROAS = 0, validACOS = 0;

    data.forEach(row => {
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
    });

    // Calculate averages
    if (validCTR > 0) summary.averageCTR /= validCTR;
    if (validCPC > 0) summary.averageCPC /= validCPC;
    if (validROAS > 0) summary.averageROAS /= validROAS;
    if (validACOS > 0) summary.averageACOS /= validACOS;

    return summary;
  }

  /**
   * Identify top performing keywords
   */
  identifyTopPerformers(data) {
    const performers = {
      byROAS: data.filter(row => row.calculated_roas).sort((a, b) => b.calculated_roas - a.calculated_roas).slice(0, 10),
      byCTR: data.filter(row => row.calculated_ctr).sort((a, b) => b.calculated_ctr - a.calculated_ctr).slice(0, 10),
      bySales: data.filter(row => row.sales).sort((a, b) => b.sales - a.sales).slice(0, 10),
      byConversions: data.filter(row => row.conversions).sort((a, b) => b.conversions - a.conversions).slice(0, 10)
    };

    return performers;
  }

  /**
   * Identify bottom performing keywords
   */
  identifyBottomPerformers(data) {
    const performers = {
      byROAS: data.filter(row => row.calculated_roas).sort((a, b) => a.calculated_roas - b.calculated_roas).slice(0, 10),
      byCTR: data.filter(row => row.calculated_ctr).sort((a, b) => a.calculated_ctr - b.calculated_ctr).slice(0, 10),
      byACOS: data.filter(row => row.calculated_acos).sort((a, b) => b.calculated_acos - a.calculated_acos).slice(0, 10)
    };

    return performers;
  }

  /**
   * Analyze trends in the data
   */
  analyzeTrends(data) {
    const trends = {
      highCostKeywords: data.filter(row => row.cost > 100).length,
      lowCTRKeywords: data.filter(row => row.calculated_ctr && row.calculated_ctr < 1).length,
      highACOSKeywords: data.filter(row => row.calculated_acos && row.calculated_acos > 50).length,
      zeroConversionKeywords: data.filter(row => row.conversions === 0 || !row.conversions).length
    };

    return trends;
  }

  /**
   * Generate initial recommendations
   */
  generateRecommendations(data) {
    const recommendations = [];

    const lowCTRCount = data.filter(row => row.calculated_ctr && row.calculated_ctr < 1).length;
    if (lowCTRCount > 0) {
      recommendations.push({
        type: 'low_ctr',
        priority: 'high',
        description: `${lowCTRCount} keywords have CTR below 1%. Consider improving ad relevance and targeting.`,
        impact: 'medium'
      });
    }

    const highACOSCount = data.filter(row => row.calculated_acos && row.calculated_acos > 50).length;
    if (highACOSCount > 0) {
      recommendations.push({
        type: 'high_acos',
        priority: 'high',
        description: `${highACOSCount} keywords have ACOS above 50%. Consider pausing or optimizing these keywords.`,
        impact: 'high'
      });
    }

    const zeroConversionCount = data.filter(row => row.conversions === 0 || !row.conversions).length;
    if (zeroConversionCount > 0) {
      recommendations.push({
        type: 'zero_conversions',
        priority: 'medium',
        description: `${zeroConversionCount} keywords have zero conversions. Review targeting and landing pages.`,
        impact: 'medium'
      });
    }

    return recommendations;
  }
}

module.exports = new CSVProcessor(); 