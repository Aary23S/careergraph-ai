'use strict';

function uuidPrimaryKey(Sequelize) {
  return {
    id: {
      type: Sequelize.UUID,
      allowNull: false,
      primaryKey: true,
    },
  };
}

function timestamps(Sequelize) {
  return {
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW,
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW,
    },
  };
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      ...uuidPrimaryKey(Sequelize),
      email: { type: Sequelize.STRING, allowNull: false, unique: true },
      password_hash: { type: Sequelize.STRING, allowNull: false },
      email_verified_at: { type: Sequelize.DATE },
      email_verification_token: { type: Sequelize.STRING },
      password_reset_token: { type: Sequelize.STRING },
      password_reset_expires_at: { type: Sequelize.DATE },
      last_login_at: { type: Sequelize.DATE },
      ...timestamps(Sequelize),
    });

    await queryInterface.createTable('refresh_tokens', {
      ...uuidPrimaryKey(Sequelize),
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      token_hash: { type: Sequelize.STRING, allowNull: false },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      revoked_at: { type: Sequelize.DATE },
      ...timestamps(Sequelize),
    });

    await queryInterface.createTable('profiles', {
      ...uuidPrimaryKey(Sequelize),
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      name: { type: Sequelize.STRING, allowNull: false },
      phone: { type: Sequelize.STRING },
      location: { type: Sequelize.STRING },
      target_roles: { type: Sequelize.JSON, allowNull: false, defaultValue: [] },
      target_companies: { type: Sequelize.JSON, allowNull: false, defaultValue: [] },
      preferred_locations: { type: Sequelize.JSON, allowNull: false, defaultValue: [] },
      remote_preference: { type: Sequelize.STRING },
      experience: { type: Sequelize.STRING },
      skills: { type: Sequelize.JSON, allowNull: false, defaultValue: [] },
      salary_preference: { type: Sequelize.STRING },
      bio: { type: Sequelize.TEXT },
      ...timestamps(Sequelize),
    });

    await queryInterface.createTable('resumes', {
      ...uuidPrimaryKey(Sequelize),
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      file_name: { type: Sequelize.STRING, allowNull: false },
      storage_key: { type: Sequelize.STRING, allowNull: false },
      content_type: { type: Sequelize.STRING, allowNull: false },
      size_bytes: { type: Sequelize.INTEGER, allowNull: false },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      version: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      ...timestamps(Sequelize),
    });

    await queryInterface.createTable('connections', {
      ...uuidPrimaryKey(Sequelize),
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      name: { type: Sequelize.STRING, allowNull: false },
      company: { type: Sequelize.STRING },
      title: { type: Sequelize.STRING },
      location: { type: Sequelize.STRING },
      email: { type: Sequelize.STRING },
      profile_url: { type: Sequelize.STRING },
      connected_date: { type: Sequelize.DATEONLY },
      industry: { type: Sequelize.STRING },
      notes: { type: Sequelize.TEXT },
      relationship_status: { type: Sequelize.STRING },
      relationship_strength: { type: Sequelize.STRING },
      last_contacted_date: { type: Sequelize.DATEONLY },
      next_follow_up_date: { type: Sequelize.DATEONLY },
      import_batch_id: { type: Sequelize.STRING },
      ...timestamps(Sequelize),
    });

    await queryInterface.createTable('connection_tags', {
      ...uuidPrimaryKey(Sequelize),
      connection_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'connections', key: 'id' },
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      tag: { type: Sequelize.STRING, allowNull: false },
      ...timestamps(Sequelize),
    });
    await queryInterface.addIndex('connection_tags', ['connection_id', 'tag'], { unique: true });

    await queryInterface.createTable('companies', {
      ...uuidPrimaryKey(Sequelize),
      name: { type: Sequelize.STRING, allowNull: false },
      normalized_name: { type: Sequelize.STRING, allowNull: false, unique: true },
      ...timestamps(Sequelize),
    });

    await queryInterface.createTable('jobs', {
      ...uuidPrimaryKey(Sequelize),
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      company_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'companies', key: 'id' },
      },
      title: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT },
      location: { type: Sequelize.STRING },
      employment_type: { type: Sequelize.STRING },
      experience_min: { type: Sequelize.INTEGER },
      experience_max: { type: Sequelize.INTEGER },
      url: { type: Sequelize.STRING },
      source: { type: Sequelize.STRING },
      source_job_id: { type: Sequelize.STRING },
      posted_date: { type: Sequelize.DATEONLY },
      first_seen_date: { type: Sequelize.DATEONLY },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'new' },
      is_archived: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      ...timestamps(Sequelize),
    });

    await queryInterface.createTable('applications', {
      ...uuidPrimaryKey(Sequelize),
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      job_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'jobs', key: 'id' },
        onDelete: 'CASCADE',
      },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'saved' },
      applied_at: { type: Sequelize.DATE },
      last_status_at: { type: Sequelize.DATE },
      ...timestamps(Sequelize),
    });
    await queryInterface.addIndex('applications', ['user_id', 'job_id'], { unique: true });

    await queryInterface.createTable('application_events', {
      ...uuidPrimaryKey(Sequelize),
      application_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'applications', key: 'id' },
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      status: { type: Sequelize.STRING, allowNull: false },
      event_type: { type: Sequelize.STRING, allowNull: false },
      notes: { type: Sequelize.TEXT },
      occurred_at: { type: Sequelize.DATE, allowNull: false },
      ...timestamps(Sequelize),
    });

    await queryInterface.createTable('outreach', {
      ...uuidPrimaryKey(Sequelize),
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      connection_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'connections', key: 'id' },
        onDelete: 'CASCADE',
      },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'not_contacted' },
      contact_date: { type: Sequelize.DATEONLY },
      follow_up_date: { type: Sequelize.DATEONLY },
      notes: { type: Sequelize.TEXT },
      outcome: { type: Sequelize.TEXT },
      ...timestamps(Sequelize),
    });

    await queryInterface.createTable('outreach_events', {
      ...uuidPrimaryKey(Sequelize),
      outreach_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'outreach', key: 'id' },
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      status: { type: Sequelize.STRING, allowNull: false },
      event_type: { type: Sequelize.STRING, allowNull: false },
      notes: { type: Sequelize.TEXT },
      occurred_at: { type: Sequelize.DATE, allowNull: false },
      ...timestamps(Sequelize),
    });

    await queryInterface.createTable('notes', {
      ...uuidPrimaryKey(Sequelize),
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      entity_type: { type: Sequelize.STRING, allowNull: false },
      entity_id: { type: Sequelize.UUID, allowNull: false },
      content: { type: Sequelize.TEXT, allowNull: false },
      ...timestamps(Sequelize),
    });

    await queryInterface.createTable('notifications', {
      ...uuidPrimaryKey(Sequelize),
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      type: { type: Sequelize.STRING, allowNull: false },
      title: { type: Sequelize.STRING, allowNull: false },
      message: { type: Sequelize.TEXT, allowNull: false },
      is_read: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      related_entity_type: { type: Sequelize.STRING },
      related_entity_id: { type: Sequelize.UUID },
      due_at: { type: Sequelize.DATE },
      ...timestamps(Sequelize),
    });

    await queryInterface.createTable('user_preferences', {
      ...uuidPrimaryKey(Sequelize),
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      preferred_job_locations: { type: Sequelize.JSON, allowNull: false, defaultValue: [] },
      preferred_job_roles: { type: Sequelize.JSON, allowNull: false, defaultValue: [] },
      remote_preference: { type: Sequelize.STRING },
      notifications_enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      ...timestamps(Sequelize),
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('user_preferences');
    await queryInterface.dropTable('notifications');
    await queryInterface.dropTable('notes');
    await queryInterface.dropTable('outreach_events');
    await queryInterface.dropTable('outreach');
    await queryInterface.dropTable('application_events');
    await queryInterface.dropTable('applications');
    await queryInterface.dropTable('jobs');
    await queryInterface.dropTable('companies');
    await queryInterface.dropTable('connection_tags');
    await queryInterface.dropTable('connections');
    await queryInterface.dropTable('resumes');
    await queryInterface.dropTable('profiles');
    await queryInterface.dropTable('refresh_tokens');
    await queryInterface.dropTable('users');
  },
};
