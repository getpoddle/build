DO $$
DECLARE
  rec RECORD;
  ws_rec RECORD;
  zone_elem jsonb;
  agent text;
  tension_num integer;
  conflicts_map jsonb;
  agent_alignment_result jsonb;
  ws_count integer;
  avg_align_score integer;
  c integer;
  t integer;
  avg_t integer;
  cr numeric;
  as_val integer;
  all_align integer[];
BEGIN
  FOR rec IN SELECT user_id FROM user_pattern_intelligence LOOP
    conflicts_map := '{}';
    all_align := ARRAY[]::integer[];
    ws_count := 0;

    FOR ws_rec IN
      SELECT ws.conflict_zones, ws.alignment_score
      FROM workspace_members wm
      JOIN workspace_synthesis ws ON ws.workspace_id = wm.workspace_id
      WHERE wm.user_id = rec.user_id
    LOOP
      ws_count := ws_count + 1;
      IF ws_rec.alignment_score IS NOT NULL THEN
        all_align := all_align || ws_rec.alignment_score;
      END IF;

      IF ws_rec.conflict_zones IS NOT NULL AND jsonb_typeof(ws_rec.conflict_zones) = 'array' THEN
        FOR zone_elem IN SELECT * FROM jsonb_array_elements(ws_rec.conflict_zones) LOOP
          tension_num := COALESCE((zone_elem->>'tension_level')::integer, 50);
          FOREACH agent IN ARRAY ARRAY[zone_elem->>'agent_a', zone_elem->>'agent_b'] LOOP
            IF agent IS NOT NULL AND agent <> '' THEN
              IF conflicts_map ? agent THEN
                conflicts_map := jsonb_set(conflicts_map, ARRAY[agent, 'c'],
                  to_jsonb((conflicts_map->agent->>'c')::integer + 1));
                conflicts_map := jsonb_set(conflicts_map, ARRAY[agent, 't'],
                  to_jsonb((conflicts_map->agent->>'t')::integer + tension_num));
              ELSE
                conflicts_map := conflicts_map || jsonb_build_object(agent,
                  jsonb_build_object('c', 1, 't', tension_num));
              END IF;
            END IF;
          END LOOP;
        END LOOP;
      END IF;
    END LOOP;

    agent_alignment_result := '{}';
    FOR agent IN SELECT jsonb_object_keys(conflicts_map) LOOP
      c := (conflicts_map->agent->>'c')::integer;
      t := (conflicts_map->agent->>'t')::integer;
      avg_t := CASE WHEN c > 0 THEN t / c ELSE 0 END;
      cr := LEAST(1.0, c::numeric / GREATEST(ws_count, 1));
      as_val := GREATEST(0, LEAST(100, ROUND(100 - (cr * 50) - (avg_t * 0.5))::integer));
      agent_alignment_result := agent_alignment_result || jsonb_build_object(agent,
        jsonb_build_object('conflict_count', c, 'avg_tension', avg_t, 'alignment_score', as_val));
    END LOOP;

    avg_align_score := NULL;
    IF array_length(all_align, 1) > 0 THEN
      SELECT ROUND(AVG(v)) INTO avg_align_score FROM unnest(all_align) v;
    END IF;

    UPDATE user_pattern_intelligence
    SET agent_alignment_map = agent_alignment_result,
        avg_alignment_score = avg_align_score
    WHERE user_id = rec.user_id;

  END LOOP;
END $$;
