'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('cold_email_outreach', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
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
      recipient_email: {
        type: Sequelize.STRING,
        allowNull: false
      },
      recipient_name: {
        type: Sequelize.STRING,
        allowNull: true
      },
      recipient_role: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'other'
      },
      organization_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      normalized_organization: {
        type: Sequelize.STRING,
        allowNull: false
      },
      subject: {
        type: Sequelize.STRING,
        allowNull: true
      },
      sent_date: {
        type: Sequelize.DATE,
        allowNull: false
      },
      email_body: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      gmail_message_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      gmail_thread_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      source: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'gmail_sync'
      },
      reply_status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'sent_awaiting_reply'
      },
      revert_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      revert_message: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      next_action_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      next_action_notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      company_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'companies',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      connection_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'connections',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      application_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'applications',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      job_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'jobs',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
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

    await queryInterface.addIndex('cold_email_outreach', ['user_id', 'sent_date']);
    await queryInterface.addIndex('cold_email_outreach', ['user_id', 'reply_status']);
    await queryInterface.addIndex('cold_email_outreach', ['user_id', 'normalized_organization']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('cold_email_outreach');
  }
};
