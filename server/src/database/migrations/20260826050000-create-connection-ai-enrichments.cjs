'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('connection_ai_enrichments', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      connection_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'connections',
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

      // AI-derived Connection Intelligence fields
      professional_role: {
        type: Sequelize.STRING,
        allowNull: true
      },
      role_family: {
        type: Sequelize.STRING,
        allowNull: true
      },
      career_level: {
        type: Sequelize.STRING,
        allowNull: true
      },
      technical_domains: {
        type: Sequelize.JSON,
        allowNull: true
      },
      technologies: {
        type: Sequelize.JSON,
        allowNull: true
      },
      industry_domains: {
        type: Sequelize.JSON,
        allowNull: true
      },
      expertise_areas: {
        type: Sequelize.JSON,
        allowNull: true
      },
      leadership_level: {
        type: Sequelize.STRING,
        allowNull: true
      },
      summary: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      confidence: {
        type: Sequelize.FLOAT,
        allowNull: true
      },

      // Human-corrected overrides
      user_corrected_professional_role: {
        type: Sequelize.STRING,
        allowNull: true
      },
      user_corrected_role_family: {
        type: Sequelize.STRING,
        allowNull: true
      },
      user_corrected_career_level: {
        type: Sequelize.STRING,
        allowNull: true
      },
      user_corrected_technical_domains: {
        type: Sequelize.JSON,
        allowNull: true
      },
      user_corrected_technologies: {
        type: Sequelize.JSON,
        allowNull: true
      },
      user_corrected_industry_domains: {
        type: Sequelize.JSON,
        allowNull: true
      },
      user_corrected_expertise_areas: {
        type: Sequelize.JSON,
        allowNull: true
      },
      user_corrected_leadership_level: {
        type: Sequelize.STRING,
        allowNull: true
      },
      user_corrected_summary: {
        type: Sequelize.TEXT,
        allowNull: true
      },

      // Observability and metadata
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
    await queryInterface.dropTable('connection_ai_enrichments');
  }
};
