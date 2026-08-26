'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    let hasVectorExtension = false;
    if (queryInterface.sequelize.options.dialect === 'postgres') {
      try {
        await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS vector;');
        hasVectorExtension = true;
      } catch (err) {
        console.warn('[Migration] pgvector extension not available on this server. Falling back to JSON storage.');
      }
    }

    await queryInterface.createTable('semantic_embeddings', {
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
      embedding: {
        type: hasVectorExtension ? 'vector' : Sequelize.JSON,
        allowNull: false
      },
      content_hash: {
        type: Sequelize.STRING,
        allowNull: false
      },
      embedding_model: {
        type: Sequelize.STRING,
        allowNull: false
      },
      embedding_dimension: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'completed'
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

    // Add indexes for semantic embeddings
    await queryInterface.addIndex('semantic_embeddings', ['user_id']);
    await queryInterface.addIndex('semantic_embeddings', ['entity_type', 'entity_id']);
    await queryInterface.addIndex('semantic_embeddings', ['user_id', 'entity_type', 'entity_id', 'embedding_model'], {
      unique: true,
      name: 'semantic_embeddings_unique_entity_model'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('semantic_embeddings');
  }
};
