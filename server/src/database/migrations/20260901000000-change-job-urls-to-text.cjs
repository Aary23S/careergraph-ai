'use strict';

/**
 * Migration: Change jobs.url and jobs.source_url from VARCHAR(255) (STRING) to TEXT.
 *
 * Schema Decision Rationale:
 * Job URLs and source URLs (such as LinkedIn job-alert tracking links and Adzuna redirects)
 * frequently exceed 255 characters. Changing these columns to TEXT prevents string truncation
 * and database insertion errors when ingesting jobs with long URLs.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('jobs', 'url', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.changeColumn('jobs', 'source_url', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('jobs', 'url', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.changeColumn('jobs', 'source_url', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
};
