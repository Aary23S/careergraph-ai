'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('job_ai_enrichments', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      job_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'jobs',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      provider: {
        type: Sequelize.STRING,
        allowNull: false
      },
      model: {
        type: Sequelize.STRING,
        allowNull: false
      },
      prompt_version: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      schema_version: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'pending'
      },
      input_hash: {
        type: Sequelize.STRING,
        allowNull: false
      },

      // AI-derived interpretations
      role_category: {
        type: Sequelize.STRING,
        allowNull: true
      },
      seniority: {
        type: Sequelize.STRING,
        allowNull: true
      },
      required_skills: {
        type: Sequelize.JSON,
        allowNull: true
      },
      preferred_skills: {
        type: Sequelize.JSON,
        allowNull: true
      },
      location: {
        type: Sequelize.STRING,
        allowNull: true
      },
      remote_type: {
        type: Sequelize.STRING,
        allowNull: true
      },
      employment_type: {
        type: Sequelize.STRING,
        allowNull: true
      },
      experience_min_years: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      experience_max_years: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      domain: {
        type: Sequelize.JSON,
        allowNull: true
      },
      responsibilities: {
        type: Sequelize.JSON,
        allowNull: true
      },
      summary: {
        type: Sequelize.TEXT,
        allowNull: true
      },

      // Quality tracking & metadata
      confidence: {
        type: Sequelize.FLOAT,
        allowNull: true
      },
      raw_response: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      latency_ms: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      error_code: {
        type: Sequelize.STRING,
        allowNull: true
      },

      // User-corrected overrides
      user_corrected_role_category: {
        type: Sequelize.STRING,
        allowNull: true
      },
      user_corrected_seniority: {
        type: Sequelize.STRING,
        allowNull: true
      },
      user_corrected_required_skills: {
        type: Sequelize.JSON,
        allowNull: true
      },
      user_corrected_preferred_skills: {
        type: Sequelize.JSON,
        allowNull: true
      },
      user_corrected_location: {
        type: Sequelize.STRING,
        allowNull: true
      },
      user_corrected_remote_type: {
        type: Sequelize.STRING,
        allowNull: true
      },
      user_corrected_employment_type: {
        type: Sequelize.STRING,
        allowNull: true
      },
      user_corrected_experience_min_years: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      user_corrected_experience_max_years: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      user_corrected_domain: {
        type: Sequelize.JSON,
        allowNull: true
      },
      user_corrected_responsibilities: {
        type: Sequelize.JSON,
        allowNull: true
      },
      user_corrected_summary: {
        type: Sequelize.TEXT,
        allowNull: true
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('job_ai_enrichments');
  }
};
