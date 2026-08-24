'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Add columns to user_preferences
    await queryInterface.addColumn('user_preferences', 'notify_highly_relevant', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });
    await queryInterface.addColumn('user_preferences', 'notify_strong_referral', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });
    await queryInterface.addColumn('user_preferences', 'notify_target_company', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });
    await queryInterface.addColumn('user_preferences', 'daily_digest_enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });
    await queryInterface.addColumn('user_preferences', 'notify_low_relevance', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    await queryInterface.addColumn('user_preferences', 'minimum_match_score', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 80
    });

    // 2. Add priority column to jobs
    await queryInterface.addColumn('jobs', 'priority', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'standard'
    });

    // 3. Create job_deduplication_logs table
    await queryInterface.createTable('job_deduplication_logs', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      source: {
        type: Sequelize.STRING,
        allowNull: false
      },
      duplicate_text: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      matched_job_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'jobs',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      reason: {
        type: Sequelize.STRING,
        allowNull: false
      },
      logged_at: {
        type: Sequelize.DATE,
        allowNull: false
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
    await queryInterface.dropTable('job_deduplication_logs');
    await queryInterface.removeColumn('jobs', 'priority');
    await queryInterface.removeColumn('user_preferences', 'minimum_match_score');
    await queryInterface.removeColumn('user_preferences', 'notify_low_relevance');
    await queryInterface.removeColumn('user_preferences', 'daily_digest_enabled');
    await queryInterface.removeColumn('user_preferences', 'notify_target_company');
    await queryInterface.removeColumn('user_preferences', 'notify_strong_referral');
    await queryInterface.removeColumn('user_preferences', 'notify_highly_relevant');
  }
};
