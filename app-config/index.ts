import { AppConfig, LayerType } from "../src/app-config.types"
import { AnimatedLogo } from "./components/AnimatedLogo"
import buildJSON from "./build.json"
import { Welcome } from "./components/pages/Welcome"
import { About } from "./components/pages/About"
import { Imprint } from "./components/pages/Imprint"
import { RKIFeatureInfo } from "./components/RKIFeatureInfo"

function normalizeProperties(data, postfix, properties) {
  const minMax = properties.reduce((acc, prop) => Object.assign(acc, {
    [prop]: { min: Infinity, max: -Infinity, factor: 1 }
  }), {})
  for (const props of data) {
    for(const prop of properties) {
      const value = props[prop]
      const mm = minMax[prop]
      mm.min = Math.min(value, mm.min)
      mm.max = Math.max(value, mm.max)
    }
  }
  for(const prop of properties) {
    const mm = minMax[prop]
    mm.factor = 1 / (mm.max - mm.min)
  }
  for (const props of data) {
    for(const prop of properties) {
      props[`${prop}${postfix}`] = props[prop] * minMax[prop].factor
    }
  }
  return data
}

export const config: AppConfig = {
  ui: {
    Logo: AnimatedLogo
  },
  content: {
    pages: [{
      id: 'welcome-page',
      title: 'Willkommen',
      Component: Welcome
    }, {
      id: 'about-page',
      title: 'About',
      Component: About
    }, {
      id: 'imprint-page',
      title: 'Impressum',
      Component: Imprint
    }]
  },
  buildJSON,
  mapSettings: {
    constraints: [[56.47462805805594,  2.3730468750000004], [43.27103747280261, 17.885742187500004]]
  },
  defaultVisual: 'rki',
  datasources: {
    'rki-case-numbers': {
      url: (dateString) => `https://warte.app/api/rki/rki-district-case-numbers?fields=BL,RS,EWZ,cases,deaths,cases_per_100k,cases_per_population,cases7_per_100k,death_rate&limit=0&date=${dateString}`
    }
  },
  visuals: {
    'rki': {
      name: 'RKI Fallzahlen',
      description: 'Anteil der betroffenen pro Landkreis',
      defaultMapping: 'case-numbers-to-districts',
      mappings: {
        'case-numbers-to-districts': {
          datasourceId: 'rki-case-numbers',
          geoId: 'districts-city-details',
          geoProperty: 'cca_2',
          dataProperty: 'RS',
          FeatureInfo: RKIFeatureInfo,
          mappables: [{
            property: 'cases_per_population_norm',
            title: 'Betroffenenrate',
            default: true
          }, {
            property: 'cases_norm',
            title: 'Fälle',
          }, {
            property: 'deaths_norm',
            title: 'Verstorbene',
          }, {
            property: 'cases_per_100k_norm',
            title: 'Fälle pro 100k Einwohner',
          }, {
            property: 'death_rate_norm',
            title: 'Sterberate',
          }],
          transformData: (json) => {
            if (!json.result.length) {
              return null
            }

            const normalized = normalizeProperties(json.result, '_norm', [
              'cases_per_population',
              'cases',
              'deaths',
              'cases_per_100k',
              'death_rate'
            ])

            const propertiesByCCA2 = normalized.reduce((acc, curr) => Object.assign(acc, {
              [curr.RS]: curr
            }), {})

            return {
              data: propertiesByCCA2
            };
          }
        }
      },
      layerGroups: [{
        title: 'Flächen',
        layers: ['areas-fill'],
        default: true
      }, {
        title: 'Balken',
        layers: ['extrusion'],
        pitch: 40,
        bearing: 20,
      }],
      layers: [
        // See the Mapbox Style Specification for details on data expressions.
        // https://docs.mapbox.com/mapbox-gl-js/style-spec/#expressions
        (dataField, timeKey) => ({
          id: "areas-fill",
          sourceId: "case-numbers-to-districts",
          type: LayerType.FILL,
          paint: {
            'fill-color': [
              'interpolate',
              ['linear'],
              ['get', dataField, ['get', timeKey]],
              // ['get', dataField],
              0, '#f8fbff',
              0.025, '#e1ebf5',
              0.05, '#cadbed',
              0.1, '#a6c9df',
              0.2, '#79add2',
              0.35, '#5591c3',
              0.5, '#3771b0',
              0.65, '#205297',
              0.8, '#113068',
            ],
            'fill-opacity': 0.8,
          }
        }),
        (dataField, timeKey) => ({
          id: "extrusion",
          sourceId: "case-numbers-to-districts",
          type: LayerType.FILL_EXTRUSION,
          'paint': { 
            'fill-extrusion-color': [
              'interpolate',
              ['linear'],
              ['get', dataField, ['get', timeKey]],
              0, '#f8fbff',
              0.025, '#e1ebf5',
              0.05, '#cadbed',
              0.1, '#a6c9df',
              0.2, '#79add2',
              0.35, '#5591c3',
              0.5, '#3771b0',
              0.65, '#205297',
              0.8, '#113068',
            ],
            'fill-extrusion-height': [
              'interpolate',
              ['linear'],
              ['get', dataField, ['get', timeKey]],
              0, 1000,
              0.025, 2500,
              0.05, 5000,
              0.1, 10000,
              0.2, 20000,
              0.35, 40000,
              0.5, 60000,
              0.65, 100000,
              0.8, 160000,
            ],
            'fill-extrusion-base': 1,
            'fill-extrusion-opacity': 0.5
          }
        }),
        () => ({
          id: "hover",
          sourceId: "case-numbers-to-districts",
          type: LayerType.LINE,
          paint: {
            'line-color': '#627BC1',
            'line-width': [
              'case',
              ['boolean', ['feature-state', 'hover'], false],
              4,
              0
            ]
          }
        })
      ],
      search: {
        placeholder: 'Landkreis',
        inMappings: [{
          id: 'case-numbers-to-districts',
          properties: ['name'],
          getCoordinates: (feature) => {
            return feature.properties.geo_point_2d
          }
        }],
        notFoundMessage: 'Leider keinen Landkreis gefunden.'
      }
    },
  },
  geos: {
    'districts-city-details': {
      url: '/data/de_districts_all.geojson'
    }
  }
}