'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Create telegram_integrations table
    await queryInterface.createTable('telegram_integrations', {
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
      telegram_user_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      telegram_username: {
        type: Sequelize.STRING,
        allowNull: true
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'connected'
      },
      linked_at: {
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

    // 2. Create incoming_jobs table
    await queryInterface.createTable('incoming_jobs', {
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
        allowNull: false,
        defaultValue: 'telegram'
      },
      raw_text: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      telegram_message_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      telegram_user_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'pending_review'
      },
      parsed_data: {
        type: Sequelize.JSON,
        allowNull: true
      },
      match_score: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      received_at: {
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

    // Unique index on incoming_jobs for idempotency if it has telegram_message_id
    await queryInterface.addIndex(
      'incoming_jobs',
      ['user_id', 'telegram_message_id'],
      {
        unique: true,
        name: 'unique_user_telegram_message',
        where: {
          telegram_message_id: {
            [Sequelize.Op.ne]: null
          }
        }
      }
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('incoming_jobs');
    await queryInterface.dropTable('telegram_integrations');
  }
};
