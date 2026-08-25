'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const separatorRegex = /&middot;|·|•|\||\s+-\s+|\s+–\s+/;

    const companies = await queryInterface.sequelize.query(
      'SELECT id, name, normalized_name FROM companies',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    for (const comp of companies) {
      if (comp.name && separatorRegex.test(comp.name)) {
        const cleanName = comp.name.split(separatorRegex)[0].trim();
        const normalized_name = cleanName.toLowerCase().replace(/\s+/g, ' ');

        // Check if a company with this clean normalized_name already exists
        const [existing] = await queryInterface.sequelize.query(
          'SELECT id FROM companies WHERE normalized_name = :normalized_name LIMIT 1',
          {
            replacements: { normalized_name },
            type: queryInterface.sequelize.QueryTypes.SELECT
          }
        );

        if (existing && existing.id !== comp.id) {
          // Re-map all jobs linked to this dirty company to point to the clean one
          await queryInterface.sequelize.query(
            'UPDATE jobs SET company_id = :cleanId WHERE company_id = :dirtyId',
            {
              replacements: { cleanId: existing.id, dirtyId: comp.id }
            }
          );
          // Delete the now redundant dirty company record
          await queryInterface.sequelize.query(
            'DELETE FROM companies WHERE id = :dirtyId',
            {
              replacements: { dirtyId: comp.id }
            }
          );
        } else {
          // Update the dirty company record in place
          await queryInterface.sequelize.query(
            'UPDATE companies SET name = :name, normalized_name = :normalized_name WHERE id = :id',
            {
              replacements: { name: cleanName, normalized_name, id: comp.id }
            }
          );
        }
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Non-destructive cleanup migration
  }
};
