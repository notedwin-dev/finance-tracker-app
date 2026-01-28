export const getKey = (baseKey: string, profileKey: string) => {
  // PROFILE is always global in this context to determine the current user
  if (baseKey === profileKey) return baseKey;

  try {
    const profileStr = localStorage.getItem(profileKey);
    if (profileStr) {
      const profile = JSON.parse(profileStr);
      // CRITICAL: We only use the user-specific suffix IF they are logged in.
      // If we use the suffix while they are technically logged out in storage,
      // we'll be looking at an empty user key instead of the guest key.
      if (profile.id && profile.isLoggedIn) {
        return `${baseKey}_${profile.id}`;
      }
    }
  } catch (e) {
    /* ignore */
  }
  // Return the base key (Guest folder)
  return baseKey;
};
