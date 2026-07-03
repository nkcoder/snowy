package main

import (
	"fmt"
	"regexp"
)

// dsIDPattern is the charset allowlist for datasource IDs that get interpolated
// into filesystem paths. IDs are app-generated today (Date.now() timestamps),
// but a malformed or imported config could carry a dsID containing "../" or a
// path separator that would escape ~/.snowy.
var dsIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]+$`)

// validateDsID rejects any dsID that is empty or contains characters outside the
// allowlist. It guards the cache/history/queries path builders at the trust
// boundary against path traversal.
func validateDsID(dsID string) error {
	if !dsIDPattern.MatchString(dsID) {
		return fmt.Errorf("invalid datasource id: %q", dsID)
	}
	return nil
}
