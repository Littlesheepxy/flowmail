export const config = {
	// Whether signup is enabled
	enableSignup: true,

	// Whether magic link is enabled
	enableMagicLink: true,

	// Whether social login is enabled
	enableSocialLogin: true,

	// Whether passkeys are enabled
	enablePasskeys: true,

	// Whether password login is enabled
	enablePasswordLogin: true,

	// Whether two factor authentication is enabled
	enableTwoFactor: true,

	// The maximum age of the session cookie in seconds
	sessionCookieMaxAge: 60 * 60 * 24 * 30,

	// Users
	users: {
		// Whether you want the user to go through an onboarding form after signup (can be defined in the OnboardingForm.tsx)
		enableOnboarding: true,
	},

	// Organizations
	organizations: {
		// Whether organizations are enabled in general
		enable: true,

		// Whether the organization should be hidden from the user (use this for multi-tenant applications)
		hideOrganization: false,

		// Should users be able to create new organizations? Otherwise only admin users can create them
		enableUsersToCreateOrganizations: true,

		// Whether users should be required to be in an organization. This will redirect users to the organization page after sign in
		requireOrganization: false,

		// Define forbidden organization slugs. Make sure to add all paths that you define as a route after /app/... to avoid routing issues
		forbiddenOrganizationSlugs: [
			"new-organization",
			"admin",
			"settings",
			"ai-demo",
			"organization-invitation",
		],
	},
} as const;
