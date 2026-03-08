'use strict';

const { mockPool } = require('../../helpers/mockDb');
const venueRepository = require('../../../src/repositories/venueRepository');

describe('Venue Repository', () => {
  beforeEach(() => {
    mockPool.execute.mockClear();
  });

  describe('findVenuesByClubId', () => {
    it('returns venues for a club ordered by name', async () => {
      const venues = [{ id: 1, name: 'Stadium', zip_code: '12345', street: 'Main St', house_number: '1', city: 'Town', link: null, google_maps_link: null, created_at: '2024-01-01' }];
      mockPool.execute.mockResolvedValueOnce([venues, []]);

      const result = await venueRepository.findVenuesByClubId(5);

      expect(result).toEqual(venues);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT id, name, zip_code, street, house_number, city, link, google_maps_link, created_at FROM venues WHERE club_id = ? ORDER BY name',
        [5]
      );
    });
  });

  describe('findVenueById', () => {
    it('returns a venue by id and club', async () => {
      const venues = [{ id: 1, name: 'Stadium' }];
      mockPool.execute.mockResolvedValueOnce([venues, []]);

      const result = await venueRepository.findVenueById(1, 5);

      expect(result).toEqual(venues);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT id, name, zip_code, street, house_number, city, link, google_maps_link, created_at FROM venues WHERE id = ? AND club_id = ?',
        [1, 5]
      );
    });
  });

  describe('createVenue', () => {
    it('inserts a venue with all fields provided', async () => {
      const insertResult = { insertId: 3, affectedRows: 1 };
      mockPool.execute.mockResolvedValueOnce([insertResult, []]);
      const data = {
        name: 'Arena',
        zip_code: '54321',
        street: 'Park Ave',
        house_number: '10',
        city: 'Metropolis',
        link: 'http://arena.com',
        google_maps_link: 'http://maps.google.com/arena',
      };

      const result = await venueRepository.createVenue(5, data);

      expect(result).toEqual(insertResult);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'INSERT INTO venues (name, zip_code, street, house_number, city, link, google_maps_link, club_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ['Arena', '54321', 'Park Ave', '10', 'Metropolis', 'http://arena.com', 'http://maps.google.com/arena', 5]
      );
    });

    it('inserts a venue with optional fields as null', async () => {
      const insertResult = { insertId: 4, affectedRows: 1 };
      mockPool.execute.mockResolvedValueOnce([insertResult, []]);
      const data = { name: 'Field' };

      const result = await venueRepository.createVenue(5, data);

      expect(result).toEqual(insertResult);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'INSERT INTO venues (name, zip_code, street, house_number, city, link, google_maps_link, club_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ['Field', null, null, null, null, null, null, 5]
      );
    });
  });

  describe('updateVenue', () => {
    it('updates a venue with all fields', async () => {
      const updateResult = { affectedRows: 1 };
      mockPool.execute.mockResolvedValueOnce([updateResult, []]);
      const data = {
        name: 'Updated Arena',
        zip_code: '99999',
        street: 'New St',
        house_number: '5',
        city: 'New City',
        link: 'http://new.com',
        google_maps_link: 'http://maps.new.com',
      };

      const result = await venueRepository.updateVenue(1, data, 5);

      expect(result).toEqual(updateResult);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'UPDATE venues SET name = ?, zip_code = ?, street = ?, house_number = ?, city = ?, link = ?, google_maps_link = ? WHERE id = ? AND club_id = ?',
        ['Updated Arena', '99999', 'New St', '5', 'New City', 'http://new.com', 'http://maps.new.com', 1, 5]
      );
    });

    it('sets optional fields to null when not provided', async () => {
      const updateResult = { affectedRows: 1 };
      mockPool.execute.mockResolvedValueOnce([updateResult, []]);
      const data = { name: 'Minimal Venue' };

      const result = await venueRepository.updateVenue(1, data, 5);

      expect(result).toEqual(updateResult);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'UPDATE venues SET name = ?, zip_code = ?, street = ?, house_number = ?, city = ?, link = ?, google_maps_link = ? WHERE id = ? AND club_id = ?',
        ['Minimal Venue', null, null, null, null, null, null, 1, 5]
      );
    });
  });

  describe('deleteVenue', () => {
    it('deletes a venue and returns the result', async () => {
      const deleteResult = { affectedRows: 1 };
      mockPool.execute.mockResolvedValueOnce([deleteResult, []]);

      const result = await venueRepository.deleteVenue(1, 5);

      expect(result).toEqual(deleteResult);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'DELETE FROM venues WHERE id = ? AND club_id = ?',
        [1, 5]
      );
    });
  });
});
