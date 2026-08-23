'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Create gmail_integrations table
    await queryInterface.createTable('gmail_integrations', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      email_address: {
        type: Sequelize.STRING,
        allowNull: false
      },
      encrypted_refresh_token: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      scope: {
        type: Sequelize.STRING,
        allowNull: true
      },
      history_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      last_sync_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'active'
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

    // 2. Create job_ingestion_events table
    await queryInterface.createTable('job_ingestion_events', {
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
      source_type: {
        type: Sequelize.STRING,
        allowNull: false
      },
      source_message_id: {
        type: Sequelize.STRING,
        allowNull: false
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false
      },
      processed_at: {
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

    // Add unique constraint on job_ingestion_events (user_id, source_type, source_message_id)
    await queryInterface.addIndex(
      'job_ingestion_events',
      ['user_id', 'source_type', 'source_message_id'],
      {
        unique: true,
        name: 'unique_user_source_message'
      }
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('job_ingestion_events');
    await queryInterface.dropTable('gmail_integrations');
  }
};
