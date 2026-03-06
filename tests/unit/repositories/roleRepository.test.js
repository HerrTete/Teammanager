'use strict';

const { mockPool } = require('../../helpers/mockDb');
const roleRepository = require('../../../src/repositories/roleRepository');

describe('Role Repository', () => {
  beforeEach(() => {
    mockPool.execute.mockClear();
  });

  describe('findUserRoles', () => {
    it('returns roles for a user', async () => {
      const roles = [
        { role: 'Trainer', club_id: 1, sport_id: 2, team_id: 3 },
      ];
      mockPool.execute.mockResolvedValueOnce([roles, []]);

      const result = await roleRepository.findUserRoles(10);

      expect(result).toEqual(roles);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT role, club_id, sport_id, team_id FROM user_roles WHERE user_id = ?',
        [10]
      );
    });

    it('returns empty array when user has no roles', async () => {
      mockPool.execute.mockResolvedValueOnce([[], []]);

      const result = await roleRepository.findUserRoles(99);

      expect(result).toEqual([]);
    });
  });

  describe('isPortalAdmin', () => {
    it('returns true when user has PortalAdmin role', async () => {
      mockPool.execute.mockResolvedValueOnce([[{ id: 1 }], []]);

      const result = await roleRepository.isPortalAdmin(10);

      expect(result).toBe(true);
      expect(mockPool.execute).toHaveBeenCalledWith(
        "SELECT id FROM user_roles WHERE user_id = ? AND role = 'PortalAdmin'",
        [10]
      );
    });

    it('returns false when user is not PortalAdmin', async () => {
      mockPool.execute.mockResolvedValueOnce([[], []]);

      const result = await roleRepository.isPortalAdmin(10);

      expect(result).toBe(false);
    });
  });

  describe('findRolesForClub', () => {
    it('returns roles matching the club plus PortalAdmin roles', async () => {
      const roles = [
        { role: 'PortalAdmin', club_id: null, sport_id: null, team_id: null },
        { role: 'Trainer', club_id: 5, sport_id: 2, team_id: 3 },
        { role: 'Spieler', club_id: 99, sport_id: 1, team_id: 1 },
      ];
      mockPool.execute.mockResolvedValueOnce([roles, []]);

      const result = await roleRepository.findRolesForClub(10, 5);

      expect(result).toEqual([
        { role: 'PortalAdmin', club_id: null, sport_id: null, team_id: null },
        { role: 'Trainer', club_id: 5, sport_id: 2, team_id: 3 },
      ]);
    });

    it('returns empty array when user has no matching roles', async () => {
      mockPool.execute.mockResolvedValueOnce([[], []]);

      const result = await roleRepository.findRolesForClub(10, 5);

      expect(result).toEqual([]);
    });

    it('parses clubId as integer for comparison', async () => {
      const roles = [
        { role: 'Vereinsmitglied', club_id: 5, sport_id: null, team_id: null },
      ];
      mockPool.execute.mockResolvedValueOnce([roles, []]);

      const result = await roleRepository.findRolesForClub(10, '5');

      expect(result).toEqual(roles);
    });
  });

  describe('getHighestRoleForClub', () => {
    it('returns PortalAdmin as highest when present', async () => {
      const roles = [
        { role: 'PortalAdmin', club_id: null, sport_id: null, team_id: null },
        { role: 'Trainer', club_id: 5, sport_id: 2, team_id: 3 },
      ];
      mockPool.execute.mockResolvedValueOnce([roles, []]);

      const result = await roleRepository.getHighestRoleForClub(10, 5);

      expect(result).toBe('PortalAdmin');
    });

    it('returns VereinsAdmin when it is the highest', async () => {
      const roles = [
        { role: 'VereinsAdmin', club_id: 5, sport_id: null, team_id: null },
        { role: 'Spieler', club_id: 5, sport_id: 1, team_id: 1 },
      ];
      mockPool.execute.mockResolvedValueOnce([roles, []]);

      const result = await roleRepository.getHighestRoleForClub(10, 5);

      expect(result).toBe('VereinsAdmin');
    });

    it('returns Trainer when it is the highest', async () => {
      const roles = [
        { role: 'Trainer', club_id: 5, sport_id: 2, team_id: 3 },
        { role: 'Spieler', club_id: 5, sport_id: 2, team_id: 3 },
      ];
      mockPool.execute.mockResolvedValueOnce([roles, []]);

      const result = await roleRepository.getHighestRoleForClub(10, 5);

      expect(result).toBe('Trainer');
    });

    it('returns Vereinsmitglied when it is the highest', async () => {
      const roles = [
        { role: 'Vereinsmitglied', club_id: 5, sport_id: null, team_id: null },
      ];
      mockPool.execute.mockResolvedValueOnce([roles, []]);

      const result = await roleRepository.getHighestRoleForClub(10, 5);

      expect(result).toBe('Vereinsmitglied');
    });

    it('returns Spieler when it is the only role', async () => {
      const roles = [
        { role: 'Spieler', club_id: 5, sport_id: 1, team_id: 1 },
      ];
      mockPool.execute.mockResolvedValueOnce([roles, []]);

      const result = await roleRepository.getHighestRoleForClub(10, 5);

      expect(result).toBe('Spieler');
    });

    it('returns null when user has no roles for the club', async () => {
      mockPool.execute.mockResolvedValueOnce([[], []]);

      const result = await roleRepository.getHighestRoleForClub(10, 5);

      expect(result).toBeNull();
    });

    it('returns null when roles exist but none match hierarchy', async () => {
      const roles = [
        { role: 'UnknownRole', club_id: 5, sport_id: null, team_id: null },
      ];
      mockPool.execute.mockResolvedValueOnce([roles, []]);

      const result = await roleRepository.getHighestRoleForClub(10, 5);

      expect(result).toBeNull();
    });
  });

  describe('isClubMember', () => {
    it('returns true when user is a club member', async () => {
      mockPool.execute.mockResolvedValueOnce([[{ id: 1 }], []]);

      const result = await roleRepository.isClubMember(10, 5);

      expect(result).toBe(true);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT id FROM club_members WHERE user_id = ? AND club_id = ?',
        [10, 5]
      );
    });

    it('returns false when user is not a club member', async () => {
      mockPool.execute.mockResolvedValueOnce([[], []]);

      const result = await roleRepository.isClubMember(10, 5);

      expect(result).toBe(false);
    });
  });
});
