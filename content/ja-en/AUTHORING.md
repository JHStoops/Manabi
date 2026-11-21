# Authoring the ja-en content pack

Placeholder. This document will describe:

- Data sources and their licences
- Pack structure, with worked examples (`course.yaml`, `units/`, `items/`, `grammar/`, `lists/`, `audio/`)
- Conventions (ids, naming, ordering, glosses)
- The procedure for adding a level
- The validation command

Importing a pack never writes to progress tables.

`lists/supplementary-words.yaml` holds common words the JLPT level lists lack (FR-234). They
count as level-list words, so after changing it import the pack, then re-run the JMdict and
Tatoeba imports to add their word items and the sentences they unblock.
