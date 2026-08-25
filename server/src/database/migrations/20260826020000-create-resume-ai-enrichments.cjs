'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('resume_ai_enrichments', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      resume_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'resumes',
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

      // AI-derived Resume Intelligence fields
      professional_title: {
        type: Sequelize.STRING,
        allowNull: true
      },
      career_level: {
        type: Sequelize.STRING,
        allowNull: true
      },
      skills: {
        type: Sequelize.JSON,
        allowNull: true
      },
      technical_domains: {
        type: Sequelize.JSON,
        allowNull: true
      },
      experience: {
        type: Sequelize.JSON,
        allowNull: true
      },
      projects: {
        type: Sequelize.JSON,
        allowNull: true
      },
      education: {
        type: Sequelize.JSON,
        allowNull: true
      },
      certifications: {
        type: Sequelize.JSON,
        allowNull: true
      },
      achievements: {
        type: Sequelize.JSON,
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
      user_corrected_professional_title: {
        type: Sequelize.STRING,
        allowNull: true
      },
      user_corrected_career_level: {
        type: Sequelize.STRING,
        allowNull: true
      },
      user_corrected_skills: {
        type: Sequelize.JSON,
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
    await queryInterface.dropTable('resume_ai_enrichments');
  }
};
