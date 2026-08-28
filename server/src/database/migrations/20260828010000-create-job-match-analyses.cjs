'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('job_match_analyses', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      job_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: {
          model: 'jobs',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      resume_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'resumes',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      provider: {
        type: Sequelize.STRING,
        allowNull: true
      },
      model: {
        type: Sequelize.STRING,
        allowNull: true
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
      rule_score: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      final_score: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      compatibility_assessment: {
        type: Sequelize.STRING,
        allowNull: true
      },
      matched_skills: {
        type: Sequelize.JSON,
        allowNull: true
      },
      missing_skills: {
        type: Sequelize.JSON,
        allowNull: true
      },
      strengths: {
        type: Sequelize.JSON,
        allowNull: true
      },
      potential_gaps: {
        type: Sequelize.JSON,
        allowNull: true
      },
      analysis_summary: {
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
      computed_at: {
        type: Sequelize.DATE,
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

  down: async (queryInterface) => {
    await queryInterface.dropTable('job_match_analyses');
  }
};
