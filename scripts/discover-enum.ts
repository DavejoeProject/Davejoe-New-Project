import { supabase } from '../src/lib/supabase';

// Comprehensive dictionary of construction words to discover all enum values
const words = [
  // basic materials
  'cement', 'sand', 'granite', 'gravel', 'aggregate', 'aggregates', 'steel', 'rebar', 'iron',
  'timber', 'wood', 'plywood', 'block', 'blocks', 'brick', 'bricks', 'concrete',
  'mortar', 'plaster', 'paint', 'paints', 'coating', 'coatings', 'primer',
  'tile', 'tiles', 'tiling', 'marble', 'granite_tiles', 'ceramic',
  // trades / domains
  'civil', 'structural', 'architectural', 'electrical', 'mechanical', 'plumbing',
  'finishing', 'joinery', 'carpentry', 'masonry', 'roofing', 'flooring', 'ceiling',
  'glazing', 'glass', 'aluminium', 'aluminum', 'metal', 'metalwork', 'ironmongery',
  'welding', 'fabrication', 'insulation', 'waterproofing',
  // tools & site
  'tools', 'equipment', 'machinery', 'plant', 'consumables', 'hardware',
  'fasteners', 'fixtures', 'fittings', 'pipes', 'conduits', 'cables', 'wires',
  'safety', 'ppe', 'general', 'other', 'miscellaneous',
  // snake_case combos
  'civil_works', 'building_materials', 'raw_materials', 'electrical_materials',
  'plumbing_materials', 'finishing_materials', 'structural_materials',
  // capitalized single words
  'Civil', 'Structural', 'Electrical', 'Mechanical', 'Plumbing', 'Finishing',
  'Cement', 'Sand', 'Granite', 'Steel', 'Timber', 'Paint', 'Tiles', 'Blocks',
  'Tools', 'Equipment', 'General', 'Other'
];

async function findEnumValues() {
  const validValues: string[] = [];
  for (const w of words) {
    const { error } = await supabase.from('materials').insert({
      material_code: 'PROBE',
      name: 'Probe',
      category: w,
      unit_of_measure: 'pcs',
    });

    if (error && error.code !== '22P02') {
      // 22P02 is invalid enum value. If it's not 22P02, the enum accepted it!
      validValues.push(w);
    }
  }

  console.log('Discovered valid enum values for material_category:', validValues);
}

findEnumValues();
