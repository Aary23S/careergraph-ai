'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('saved_connection_views', {
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
        onDelete: 'CASCADE'
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      filters_json: {
        type: Sequelize.JSON,
        allowNull: false
      },
      sort_json: {
        type: Sequelize.JSON,
        allowNull: false
      },
      filter_version: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      last_used_at: {
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

    await queryInterface.addIndex('saved_connection_views', ['user_id']);
    await queryInterface.addIndex('saved_connection_views', ['user_id', 'updated_at']);
    await queryInterface.addIndex('saved_connection_views', ['user_id', 'name'], {
      unique: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('saved_connection_views');
  }
};
