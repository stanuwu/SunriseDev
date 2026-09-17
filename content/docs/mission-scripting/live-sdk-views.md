---
title: "The live SDK views"
date: 2026-09-17
description: "Reading the catalog, manifest and generated world from a running script."
weight: 60
---
`context.sdk` is the activity view. It is a read-only window into the same data the generated
modules come from, bound to the activity that is running now. Use it to look things up at run time.
Most missions only need `device_channels`, `device_transitions`, `squad_modes` and `atom_kinds`
from it.

Every value here is re-read on each access. A handle kept across a data change errors with "stale"
instead of returning old data.

## Collections

Every collection in this page has the same shape:

```lua
local slots = context.sdk.slots
for row = 1, slots.count do
    local slot = slots:at(row)
    -- use slot
end
```

- `count` is the number of rows.
- `at(row)` returns row `row`, counting from 1.
- Some collections also have `resolve(name_or_id)` or `by_id(n)`.

There is no `pairs` in the sandbox, so always walk with a number loop like this.

## `context.sdk` members

### Identity

| member | type | meaning |
|---|---|---|
| `build_id` | string | SDK build id, `sha256:<hex>` |
| `activity_id` | string | activity id |
| `activity_row` | integer | activity row |
| `definition_hash` | integer | activity hash |
| `client_teleport_reset` | integer | the teleport state the client reports after a spawn (0) |

### Activity binding

These describe how the activity was matched to its scenario. They are for tools, not missions.

| member | type |
|---|---|
| `internal_name`, `display_name` | string or nil |
| `join_status`, `binding_disposition`, `binding_reason`, `binding_evidence_basis`, `runnable_status` | string name |
| the same five with `_code` | integer |
| `binding_full_sdk_acceptable`, `has_internal_name`, `has_matchmaking_config` | boolean |
| `selected_activity_root_tag`, `selected_scenario_tag`, `matchmaking_config_tag` | integer or nil |
| `activity_root_candidate_tags`, `scenario_name_candidate_tags`, `evidence_root_tags` | collection of integer tags |
| `binding_locators` | collection of `{tag, offset}`; `offset` is a decimal string |

### Row collections

| member | rows are | lookup |
|---|---|---|
| `squads` | squad handles | `at(row)`, `resolve(id)` |
| `authored_scenes` | scene handles | `at(row)`, `resolve(id)` |
| `slots` | slot handles | `at(row)`, `resolve(id)` |
| `activity_messages` | message rows | `at(row)`, `by_id(message_id)`, `resolve(name)` |
| `bap_services` | service rows | `at(row)`, `by_request_id(n)`, `by_response_id(n)`, `by_notification_id(n)` |
| `squad_anchors` | world rows of kind squad anchor | `at(row)` |

The squad, scene and slot handles are the same objects `context:squad`, `context:scene` and
`context:slot` return. See [Lua API reference](/docs/mission-scripting/lua-api/).

### Vocabularies

| member | what it holds |
|---|---|
| `device_channels` | `position`, `power`, `lock`; `count` |
| `device_transitions` | `open`, `close`, `power_on`, `power_off`, `lock`, `unlock`; `count`, `at(n)` |
| `squad_modes` | `reinforce`, `replace`, `reserve`; `count` |
| `lifetime_states` | `at(0..10)`, `default`, `count` |
| `atom_kinds` | a plain table of atom kind names |
| `bounded_lanes` | fixed-size client lists; see below |
| `unit` | `function(number)`; makes a device channel value |
| `position` | `function(x, y, z)`; makes a world position |

### Deep views

| member | view |
|---|---|
| `catalog` | the native catalog; nil when it is not ready |
| `manifest` | the scenario manifest; nil when it is not ready |
| `world` | the generated world of this scenario; nil when it is not ready |

## Message rows

`context.sdk.activity_messages` lists the activity messages the client and host exchange. A script
cannot send raw messages. The rows tell you which messages exist and which Lua surface handles them.

| member | meaning |
|---|---|
| `row`, `id`, `name` | row, message id, name |
| `direction` | `remote_to_client`, `client_to_remote`, `bidirectional`, `client_to_remote_special`, `name_only` |
| `coverage` | how well the wire format is known |
| `can_receive` | true when a Lua event carries this message |
| `can_send` | true when a typed Lua action sends it |
| `receive_api` | `message_event`, `typed_event` or `none` |
| `send_api` | `typed_actions` or `none` |
| `receive_surfaces`, `send_surfaces` | lists of `{id, lua_name}` |
| `matches{event = e}` | true when event `e` is this message; only when `can_receive` |
| `communication` (or `route`) | a plain table with the full route record |
| `fields` | collection of field rows |
| plus | `direction_code`, `coverage_code`, `definition_handle`, `call_form`, `definition_state`, `definition_struct_size`, `wire_min_bits`, `wire_max_bits`, `field_count`, `named_field_count`, `graph_field_count`, `authored_field_count`, `flags` |

A field row has `row`, `global_row`, `message_row`, `ordinal`, `path`, `name`, `type`, `source`,
`struct_offset`, `struct_offset_abs`, `type_code`, `bias`, `bits`, `bits_min`, `bits_max`,
`width_or_count_offset`, `repeat`, `nested_handle`, `owner_handle`, `depth`, `flags`,
`presence_bit`, `coined_name`, `documented_row`, `repeated_block`, `data_only`, `confidence` and
`exposure`, with `_code` forms for the named enums.

## BAP service rows

`context.sdk.bap_services` lists the outer network services. It is data only. A script can never
send one. The collection itself has `schema`, and the fixed flags `query_only = true` and
`script_sendable = false`.

A row has `row`, `id`, `service_id`, `request_service_id`, `response_service_id`,
`notification_service_id`, `service_role`, `security`, `response_mode`, `acceptance_policy`,
`body_shape`, `response_body_shape`, `body_exact_bytes`, `body_prefix_bytes`,
`alternate_body_prefix_bytes`, `response_body_exact_bytes`, `typed_payload_limit`, `body_codec`,
`body_codec_path`, `response_body_codec`, `response_body_codec_path`, `route`, `route_path`,
`activity_message_envelope`, `inner_message_namespace`, `lifecycle_scope`, `protocol_scope` and
the size fields `complete_encrypted_frame_overhead_bytes` and
`complete_encrypted_frame_max_bytes`.

## Bounded lanes

Some client lists have a fixed size. A bounded list cannot grow past it.

| lane | kind | size |
|---|---|---|
| `gameplay_switches` | count | 50 |
| `nav_nodes` | count | 96 |
| `nav_node_links` | count | 16 |
| `type8_field_1_0` | count | 32 |
| `type8_field_2_0` | count | 16 |
| `type8_object_refs` | object reference | 16 |
| `type53_object_refs` | object reference | 129 |

```lua
local lane = context.sdk.bounded_lanes.nav_nodes   -- name, capacity, kind
local list = lane:list()
list:append(7)          -- a count list takes int32 values
local first = list:at(1)
```

An object reference list takes slot handles in `append` and returns slot handles from `at`. No
current effect takes these lists yet. They are ready for typed bodies that need them.

## The catalog view

`context.sdk.catalog` is the whole native catalog, not just this activity.

| member | meaning |
|---|---|
| `sdk_build_sha256`, `sdk_payload_sha256`, `content_key_sha256`, `logical_ir_sha256` | 64-char hex digests |
| `activity_client_generation` | decimal string |
| `activity_row`, `scenario_row` | this activity's rows, from 1 |
| `definition_hash`, `scenario_tag` | integers |

Collections: `activities`, `scenarios`, `bubbles`, `states`, `objects`, `occurrences`, `slots`,
`texts`, `capabilities`, `gates`, `refusals`, `actor_classes`, `rsat_descriptors`, `rsat_schemas`,
`rsat_fields`, `squads`, `squad_members`, `squad_anchors`, `authored_scene_resources`,
`authored_scene_squad_edges`, `activity_binding_locators`.

Every catalog row has `row`. A text field `x` also has `x_string_offset` and `x_string_length`. A
range field `x` is read as `x_first_index` and `x_count`.

| collection | fields |
|---|---|
| `activities` | `activity_index`, `definition_hash`, `id`, `internal_name`, `display_name`, `scenario_index`, `flags`, `aliases`, `capabilities`, `selected_activity_root_tag`, `selected_scenario_tag`, `matchmaking_config_tag`, `join_status`, `binding_disposition`, `binding_reason`, `binding_evidence_basis`, `runnable_status`, `binding_flags`; plus the collections `activity_root_candidate_tags`, `scenario_name_candidate_tags`, `evidence_root_tags`, `binding_locators` |
| `scenarios` | `tag`, `reserved`, `id`, `name`, `bubbles`, `states`, `occurrences` |
| `bubbles` | `id`, `name`, `scenario_index`, `bubble_ordinal`, `name_hash`, `reserved`, `states` |
| `states` | `id`, `entry_id`, `registry_id`, `scenario_index`, `bubble_index`, `state_ordinal`, `entry_index`, `slice_set_index`, `map_bubble_index`, `state_hash`, `public_value`, `flags`, `registry_tag` |
| `objects` | `id`, `object_tag`, `object_key`, `slots`, `config_count`, `descriptor_count`, `placed_subblock_count`, `placed_leaf_count`, `placed_hop_count`, `bare_target_count`, `replicated_placement_count` |
| `occurrences` | `id`, `context_registry_key`, `registry_id`, `entry_id`, `scenario_index`, `bubble_index`, `state_index`, `object_index`, `registry_field`, `object_ordinal` |
| `slots` | `id`, `name`, `sense_schema_id`, `auth_schema_id`, `object_index`, `slot_index`, `slot_type`, `component_class`, `sense_schema`, `auth_schema`, `flags`, `reserved`, `aliases`, `capabilities` |
| `texts` | `value`, `kind`, `reserved` |
| `capabilities` | `id`, `operation`, `value_schema_id`, `subject_kind`, `subject_index`, `exposure_flags`, `candidate_exposure_flags`, `gates`, `refusals` |
| `gates` | `gate`, `status`, `reason_code`, `required`, `observed`, `would_confirm` |
| `refusals` | `id`, `exposure`, `status`, `reason_codes`, `capability_index`, `reserved` |
| `actor_classes` | `id`, `definition_tag`, `name_hash`, `rsat_tag`, `rsat_reverse_definition_tag`, `object_type`, `descriptor_array_offset`, `descriptor_array_relative`, `descriptor_array_header_offset`, `descriptor_array_data_offset`, `descriptor_element_class`, `descriptors`, `dynamic_presence_tail_count`, `authored_profile_0` to `authored_profile_3` |
| `rsat_descriptors` | `id`, `actor_class_index`, `rsat_tag`, `descriptor_ordinal`, `descriptor_offset`, `descriptor_element_class`, `component_tag`, `schema_index`, `schema_tag`, `schema_field_count`, `schema_first_field_runtime_gate`, `schema_first_field_raw_u32_at_10`, `flags`, `dynamic_presence_tail_ordinal`, `raw_row` |
| `rsat_schemas` | `id`, `schema_tag`, `schema_class`, `field_count`, `field_array_offset`, `field_array_relative`, `field_array_header_offset`, `field_array_data_offset`, `field_element_class`, `first_field_runtime_gate`, `first_field_raw_u32_at_10`, `flags`, `fields` |
| `rsat_fields` | `raw_row` |
| `squads` | `id`, `scenario_index`, `object_index`, `slot_index`, `spawner_config_tag`, `spawn_rule_config_tag`, `flags`, `occurrence_index`, `members`, `anchors` |
| `squad_members` | `id`, `squad_index`, `member_ordinal`, `member_key`, `actor_class_index`, `flags`, `candidate_count_0` to `candidate_count_5`, `default_count` |
| `squad_anchors` | `id`, `squad_index`, `point_ordinal`, `object_list_tag`, `placement_ordinal`, `flags`, `placed_entry_identity`, `position_bits_x`, `position_bits_y`, `position_bits_z` |
| `authored_scene_resources` | `id`, `slot_index`, `config_tag`, `descriptor_offset`, `resource_field_offset`, `resource_tag`, `resource_class`, `flags`, `reserved` |
| `authored_scene_squad_edges` | `id`, `scene_slot_index`, `squad_slot_index`, `config_tag`, `descriptor_offset`, `reference_field_offset`, `target_object_key`, `flags`, `reserved` |
| `activity_binding_locators` | `tag`, `reserved`, `offset` |

Field names come from `mission_script_catalog_sdk_bridge.cpp`. A 64-bit value is a decimal string.
A byte field is lowercase hex.

## The manifest view

`context.sdk.manifest` describes the scenario shards and how activities bind to them.

| member | meaning |
|---|---|
| `format_version` | manifest format |
| `source_fingerprint`, `sdk_build_sha256`, `sdk_payload_sha256`, `manifest_payload_sha256`, `shard_payload_sha256` | hex digests |
| `activity_client_generation` | decimal string |
| `activity_row`, `scenario_tag` | integers |
| `binding_completeness` | one row: `total`, `fixed_scenario`, `named_definition_unavailable`, `no_direct_fixed_activity_name`, `unresolved_runnable`, `status`, `status_name` |
| `scenarios` | rows: `scenario_tag`, `scenario_name`, `shard_payload_sha256` |
| `activity_roots` | rows: `activity_root_tag`, `scenario_tag`, `transition_descriptor_tag`, `preferred_name`, `selection_status`, `selection_status_name` |
| `activity_variants` | rows: `activity_index`, `definition_hash`, `activity_root_tag`, `scenario_tag`, `matchmaking_config_tag`, `internal_name`, the binding status fields, `full_sdk_acceptable`, `has_internal_name`, `has_matchmaking_config`, the tag collections, and `binding_locators` |

Every manifest row has `row`. Field names come from `mission_script_manifest_sdk_bridge.cpp`.

## The world view

`context.sdk.world` is the generated world of this scenario: every placed object, trigger volume,
spatial table and name. It is the best way to find where something is.

| member | meaning |
|---|---|
| `scenario_tag`, `scenario_name` | this scenario |
| `sdk_build_sha256`, `sdk_payload_sha256`, `source_fingerprint`, `manifest_payload_sha256`, `shard_payload_sha256` | hex digests |
| `diagnostics` | load diagnostics; see `mission_script_lua_world_metadata.cpp` |
| `coverage` | collection of coverage rows: `row`, `family`, `family_index`, `status`, `status_code`, `loss_mask`, `unread`, `dropped`, `partial`, `detail`, `coverage`, `coverage_code` |

Every world row has `id`, a stable text `world/<scenario hex>/<kind>/<row>`, and `row`. A field
that points at another row is nil when there is no row. A vector field is a handle with `x`, `y`,
`z`, `w` and `count`.

### Placement and geometry collections

| collection | main fields |
|---|---|
| `trigger_volumes` | `registry_key`, `slot_index`, `slot_type`, `config_tag`, `position`, `rotation`, `minimum`, `maximum`, `extrusion`, `active`, `vertices`, `triangles`, `config_name`, `shape_resource_name`, `complete` |
| `authored_placements` | `position`, `rotation`, `uniform_scale`, `object_list_tag`, `class_list_tag`, `entry_index`, `name_hash`, `identifier`, `source_object_row`, `bubble_row`, `state_row`, `object_list_name`, `class_list_name` |
| `embedded_placements` | `position`, `rotation`, `link_row`, `entry_index`, `class_list_tag`, `name_hash`, `identifier`, `object_type`, `class_list_name` |
| `container_placements` | `position`, `rotation`, `uniform_scale`, `list_row`, `object_list_tag`, `resource_tag`, `resource_class`, `entry_index`, `object_type`, `object_list_name`, `resource_name`, `class_list_name`, `complete` |
| `static_spatial_instances` | `position`, `rotation`, `scale`, `local_minimum`, `local_maximum`, `table_row`, `instance_index`, `table_tag`, `bounds_tag`, `resource_tag`, `table_name`, `bounds_name`, `resource_name` |
| `squad_anchors` | `position`, `squad_row`, `point_ordinal`, `object_list_tag`, `placement_ordinal`, `placed_entry_identity` |

A trigger volume's `vertices` and `triangles` are collections. A vertex has `value`, a triangle has
`a`, `b` and `c`.

A `<prefix>_name` field is the best known name, or nil. The same prefix also has `_name_provenance`,
`_name_provenance_code`, `_name_candidate_count`, `_name_source_tag`, `_name_source_class` and
`_name_strongest_tier_overflow`.

### Structure collections

| collection | main fields |
|---|---|
| `bubbles` | `index`, `name_hash`, `first_state_row`, `state_count`, `is_public`, `selected_name` |
| `states` | `index`, `bubble_row`, `slice_set_index`, `map_bubble_index`, `state_hash`, `entry_tag`, `registry_tag`, `enabled`, `resolved`, `selected_name`, `entry_name`, `registry_name` |
| `objects` | `object_index`, `object_tag`, `registry_key`, `registry_tag`, `bubble_row`, `state_row`, `first_slot_row`, `slot_count`, `safety`, `complete`, `registry_name`, `object_name` |
| `slots` | `object_row`, `slot_index`, `slot_type`, `name_hash`, `first_descriptor_row`, `descriptor_count`, `selected_name` |
| `descriptors` | `slot_row`, `config_tag`, `component_class`, `sense_schema`, `auth_schema`, `bubble_index`, `placement_identifier`, `config_name` |
| `typed_references` | `source_object_row`, `source_slot_row`, `target_object_row`, `target_key`, `target_slot_index`, `target_slot_type`, `join` |

The rest are for tools: `embedded_placement_links`, `container_placement_lists`,
`container_placement_owners`, `container_placement_configs`, `container_placement_components`,
`type23_placement_links`, `type23_placement_candidates`, `static_spatial_tables`,
`static_spatial_owners`, `trigger_volume_tables`, `trigger_volume_owners`,
`trigger_volume_incoming_references`, `trigger_volume_vertices`, `trigger_volume_triangles`,
`names`, `tag_names`, `name_candidates`, `inline_name_candidates`,
`authored_squad_config_contexts`, `authored_squad_placement_contexts`,
`authored_squad_point_contexts`, `authored_squad_point_placement_matches`,
`authored_squad_edge_contexts`. Their full field lists are in
`mission_script_world_sdk_fields.cpp` and `mission_script_lua_world_rows.cpp`.

## Example: list the trigger volumes whose box holds a point

The box corners are stored as the package has them. Compare them with a position you read from the
same data, for example a squad anchor.

```lua
local function volumes_at(context, x, y, z)
    local found = {}
    local volumes = context.sdk.world.trigger_volumes
    for row = 1, volumes.count do
        local volume = volumes:at(row)
        local low, high = volume.minimum, volume.maximum
        if low ~= nil and high ~= nil
            and x >= low.x and x <= high.x
            and y >= low.y and y <= high.y
            and z >= low.z and z <= high.z then
            found[#found + 1] = volume.config_name or volume.id
        end
    end
    return found
end
```

A walk over a large collection costs instructions. A callback has a budget of five million Lua
instructions. Do such searches rarely, and store the answer in a variable.

A script cannot print. To see a result, store it in a variable and read it on the "Mission state"
page. See [Finding things in game](/docs/mission-scripting/finding-things/).
