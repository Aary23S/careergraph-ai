'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('ml_predictions', {
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
      entity_type: {
        type: Sequelize.STRING,
        allowNull: false
      },
      entity_id: {
        type: Sequelize.UUID,
        allowNull: false
      },
      model_registry_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'model_registry',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      model_version: {
        type: Sequelize.STRING,
        allowNull: true
      },
      feature_version: {
        type: Sequelize.STRING,
        allowNull: true
      },
      prediction_score: {
        type: Sequelize.FLOAT,
        allowNull: false
      },
      prediction_time: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      request_id: {
        type: Sequelize.UUID,
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
    await queryInterface.dropTable('ml_predictions');
  }
};
