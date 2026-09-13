# Apps Script credential setup

Before deploying these source changes, open each consuming Apps Script project,
then **Project Settings → Script properties**, and add `BITLY_API_KEY` with the
replacement provider credential. Properties are scoped to an Apps Script project;
configure every deployed copy separately. Restrict script editor access.

The code reads this property when the integration is used. A missing or blank value
stops the API request with a configuration error. Existing caller error handling
still applies. Other script features can load without this optional credential.

Verify the normal integration after deploying, then revoke the exposed old key at
the provider. Source cleanup does not revoke credentials or remove them from Git
history. Rotation, deployment, and coordinated history cleanup remain outstanding.
Do not put replacement values in code, documentation, tests, or logs.
