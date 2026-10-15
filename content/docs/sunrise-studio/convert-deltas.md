---
title: "Convert placement deltas"
description: "Turn byte deltas that only move objects into object edits."
weight: 135
group: "Guides"
---
A project can hold placement changes as byte deltas. A byte delta records only bytes. An object
edit names the object and the values set on it, and Studio rebuilds the dependent data from it.
Studio can turn a byte delta into object edits when the rows come out exactly the same.

## Convert

1. Open the project.
2. Choose **Edit > Convert placement deltas to object edits**.

The command is one undo step. It is available only when the project has byte deltas.

## What converts

A byte delta converts only when both hold:

- it changes nothing but the position, rotation, scale or trigger bounds of known rows, plus the
  bounds data Studio derives from them;
- the new object edits compile to exactly the same bytes in those rows.

Known rows are static instances, placements, object slots, trigger volumes, lights and spawn points.
Derived data, such as collision and cull data, is rebuilt by the current rules and may differ.

The status bar sums up the result: how many deltas converted, how many assets got rebuilt derived
data, and why each other delta stayed.
[How projects store edits](/docs/sunrise-studio/project-storage/) explains both kinds.

## Limits

- A delta that changes the size of an asset stays.
- A delta on an asset that already has object edits stays.
- A delta on a SpeedTree tree stays. It has no row layout to convert.
- The saved object edits must compile first. When they do not, nothing converts.
