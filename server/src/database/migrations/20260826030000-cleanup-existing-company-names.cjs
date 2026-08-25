'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const separatorRegex = /&middot;|·|•|\||\s+-\s+|\s+–\s+/;

    // 1. Clean Connections
    const connections = await queryInterface.sequelize.query(
      'SELECT id, company, location FROM connections',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    for (const conn of connections) {
      if (conn.company && separatorRegex.test(conn.company)) {
        const parts = conn.company.split(separatorRegex);
        const cleanCompany = parts[0].trim();
        let cleanLocation = conn.location;
        if (!cleanLocation && parts[1]) {
          cleanLocation = parts.slice(1).join(' ').trim();
        }

        // Normalize company name
        const cleanCompanyWord = cleanCompany.replace(/\s+(?:inc|llc|ltd|corp|co|gmbh)\b\.?/gi, '').replace(/\s+/g, ' ').trim();
        const normalizedCompany = cleanCompanyWord.split(' ')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');

        await queryInterface.sequelize.query(
          'UPDATE connections SET company = :company, location = :location, normalized_company = :normalizedCompany WHERE id = :id',
          {
            replacements: {
              company: cleanCompany,
              location: cleanLocation || null,
              normalizedCompany: normalizedCompany || null,
              id: conn.id
            }
          }
        );
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Non-destructive cleanup migration
  }
};
