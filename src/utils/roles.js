/**
 * Roles and their permitted actions.
 * VIEWER  → read-only dashboard & records
 * ANALYST → read records + access summary/insights
 * ADMIN   → full CRUD on records AND user management
 */

const ROLES = {
  VIEWER: "viewer",
  ANALYST: "analyst",
  ADMIN: "admin",
};

/**
 * Permission flags used across middleware and service layers.
 */
const PERMISSIONS = {
  VIEW_RECORDS: "view:records",
  CREATE_RECORD: "create:record",
  UPDATE_RECORD: "update:record",
  DELETE_RECORD: "delete:record",

  VIEW_SUMMARY: "view:summary",
  VIEW_INSIGHTS: "view:insights",

  MANAGE_USERS: "manage:users",
};

/**
 * Map each role to the set of permissions it holds.
 */
const ROLE_PERMISSIONS = {
  [ROLES.VIEWER]: [PERMISSIONS.VIEW_RECORDS, PERMISSIONS.VIEW_SUMMARY],

  [ROLES.ANALYST]: [
    PERMISSIONS.VIEW_RECORDS,
    PERMISSIONS.VIEW_SUMMARY,
    PERMISSIONS.VIEW_INSIGHTS,
  ],

  [ROLES.ADMIN]: Object.values(PERMISSIONS), // all permissions
};

/**
 * Returns true if the given role has the requested permission.
 */
function can(role, permission) {
  const allowed = ROLE_PERMISSIONS[role] || [];
  return allowed.includes(permission);
}

module.exports = { ROLES, PERMISSIONS, ROLE_PERMISSIONS, can };
