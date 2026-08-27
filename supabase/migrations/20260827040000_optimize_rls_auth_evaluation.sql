-- Optimize RLS policy predicates without changing their access scope.
-- Supabase recommends evaluating auth helpers once per statement by wrapping them
-- in a scalar SELECT. The replacement below preserves every policy, role, and
-- expression except for the evaluation form of auth.uid().

DO $$
DECLARE
  policy_row RECORD;
  optimized_qual TEXT;
  optimized_check TEXT;
  statement TEXT;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual LIKE '%auth.uid()%' OR with_check LIKE '%auth.uid()%')
    ORDER BY tablename, policyname
  LOOP
    optimized_qual := CASE
      WHEN policy_row.qual IS NULL THEN NULL
      ELSE replace(policy_row.qual, 'auth.uid()', '(select auth.uid())')
    END;
    optimized_check := CASE
      WHEN policy_row.with_check IS NULL THEN NULL
      ELSE replace(policy_row.with_check, 'auth.uid()', '(select auth.uid())')
    END;

    statement := format(
      'ALTER POLICY %I ON %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );

    IF optimized_qual IS NOT NULL THEN
      statement := statement || format(' USING (%s)', optimized_qual);
    END IF;

    IF optimized_check IS NOT NULL THEN
      statement := statement || format(' WITH CHECK (%s)', optimized_check);
    END IF;

    EXECUTE statement;
  END LOOP;
END $$;
