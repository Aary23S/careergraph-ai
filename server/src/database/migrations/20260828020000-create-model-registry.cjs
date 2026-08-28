'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('model_registry', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      version: {
        type: Sequelize.STRING,
        allowNull: false
      },
      model_type: {
        type: Sequelize.STRING,
        allowNull: false
      },
      provider: {
        type: Sequelize.STRING,
        allowNull: false
      },
      framework: {
        type: Sequelize.STRING,
        allowNull: true
      },
      artifact_uri: {
        type: Sequelize.STRING,
        allowNull: true
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'candidate'
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

    await queryInterface.addIndex('model_registry', ['provider', 'name', 'version', 'model_type'], {
      unique: true,
      name: 'model_registry_identity_unique'
    });

    await queryInterface.createTable('model_evaluations', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      model_registry_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'model_registry',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      evaluation_type: {
        type: Sequelize.STRING,
        allowNull: false
      },
      dataset_version: {
        type: Sequelize.STRING,
        allowNull: true
      },
      metrics: {
        type: Sequelize.JSON,
        allowNull: true
      },
      overall_score: {
        type: Sequelize.FLOAT,
        allowNull: true
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'completed'
      },
      evaluated_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    await queryInterface.addIndex('model_evaluations', ['model_registry_id']);

    await queryInterface.createTable('model_assignments', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      model_type: {
        type: Sequelize.STRING,
        allowNull: false
      },
      environment: {
        type: Sequelize.STRING,
        allowNull: false
      },
      model_registry_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'model_registry',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      assigned_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      assigned_by: {
        type: Sequelize.STRING,
        allowNull: true
      }
    });

    // model_assignments is an append-only history log (one row per
    // promotion/rollback event) -- the "current" assignment for a given
    // (model_type, environment) is always the most recent row, so lookups
    // are ordered by assigned_at descending rather than enforced via a
    // uniqueness constraint on the pair.
    await queryInterface.addIndex('model_assignments', ['model_type', 'environment', 'assigned_at'], {
      name: 'model_assignments_lookup'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('model_assignments');
    await queryInterface.dropTable('model_evaluations');
    await queryInterface.dropTable('model_registry');
  }
};
