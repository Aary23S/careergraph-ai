'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('outreach_ai_drafts', {
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
      connection_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'connections',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      job_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'jobs',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      intent: {
        type: Sequelize.STRING,
        allowNull: false
      },
      tone: {
        type: Sequelize.STRING,
        allowNull: false
      },
      length: {
        type: Sequelize.STRING,
        allowNull: false
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
        type: Sequelize.STRING,
        allowNull: false
      },
      draft: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      personalization_points: {
        type: Sequelize.JSON,
        allowNull: true
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'generated'
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

    // Add required indexes
    await queryInterface.addIndex('outreach_ai_drafts', ['user_id']);
    await queryInterface.addIndex('outreach_ai_drafts', ['connection_id']);
    await queryInterface.addIndex('outreach_ai_drafts', ['job_id']);
    await queryInterface.addIndex('outreach_ai_drafts', ['status']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('outreach_ai_drafts');
  }
};
