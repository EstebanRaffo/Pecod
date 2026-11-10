# Bug Fix Report: 500 Error on /api/courses for External Users

## Issue Summary
When user `e.fraffo@gmail.com` (an external user without an institution) logs in and tries to access the `/api/courses` endpoint, the server returns a **500 Internal Server Error** instead of an empty list of courses.

## Root Cause
In `backend/src/courses/courses.service.ts`, the `catalog()` method had a logic error:

```typescript
// BEFORE (Line 26 - BUGGY)
...(user.role !== Role.ADMIN ? { institutionId: user.institutionId! } : {}),
```

The problem:
1. External users have `institutionId: null`
2. The non-null assertion operator `!` forced TypeScript to treat it as non-null
3. This resulted in spreading `{ institutionId: null }` into the Prisma query
4. Prisma couldn't handle `null` as an institutionId filter value, causing the 500 error

## Solution
Modified the `catalog()` method to:
1. **Early return empty array** for external users (non-admin without institutionId)
2. **Proper type-safe filtering** - only include institutionId filter when it has a valid value

```typescript
// AFTER (Fixed)
async catalog(user: AuthenticatedUser, query: CatalogQueryDto) {
  // External users (institutionId is null) should see no courses
  if (user.role !== Role.ADMIN && !user.institutionId) {
    return [];
  }

  const whereClause: any = {
    isPublished: true,
    ...(query.category ? { category: { equals: query.category, mode: 'insensitive' } } : {}),
    ...(query.technology
      ? { technology: { contains: query.technology, mode: 'insensitive' } }
      : {}),
  };

  // Only add institutionId filter for non-admin users with an institution
  if (user.role !== Role.ADMIN && user.institutionId) {
    whereClause.institutionId = user.institutionId;
  }

  // ... rest of method
}
```

## Test Results
✓ **External user test**: GET /api/courses returns 200 with empty array `[]`
✓ **UADE student regression test**: GET /api/courses returns 200 with 6 courses
✓ **Build**: No TypeScript errors

## Files Modified
- `backend/src/courses/courses.service.ts` - Fixed the `catalog()` method

## Impact
- External users can now access the /catalogo route without errors
- They correctly see no courses available (as expected)
- Existing functionality for institutional users remains unchanged
