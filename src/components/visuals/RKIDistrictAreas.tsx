import React, { Suspense } from "react";
const Source = React.lazy(() => import(/* webpackChunkName: "mapgl" */ 'react-map-gl/dist/es6/components/source'));
const Layer = React.lazy(() => import(/* webpackChunkName: "mapgl" */ 'react-map-gl/dist/es6/components/layer'));

import { VisualProps, FeatureInfoProps } from '../types';
import { getFallbackComponent } from '../getFallback';

export type State = {
  mergedGeoJSON: any; // TODO: user geojson type
}

export class RKIDistrictAreas extends React.Component<VisualProps, State> { // TODO: use geojson type
  state = {
    mergedGeoJSON: null,
  };
  dataField = 'cases_per_population';
  districtAreas = null;
  currentDataset = null;

  shouldComponentUpdate({ districtAreas, currentDataset }: VisualProps) {
    if ((districtAreas !== null && districtAreas !== this.districtAreas)
      || (currentDataset !== null && currentDataset !== this.currentDataset)) {
      this.districtAreas = districtAreas;
      this.currentDataset = currentDataset;
      this.mergeDataWithGeoFeatures({ districtAreas, currentDataset });
    }
    return true;
  }

  componentDidMount() {
    this.mergeDataWithGeoFeatures(this.props as any) // TODO: Dammit fix those lazy anytypeeees
  }

  mergeDataWithGeoFeatures({ districtAreas, currentDataset }) {
    if (!districtAreas || !currentDataset) {
      return;
    }
    const mergedGeoJSON = Object.assign({}, districtAreas, {
      features: districtAreas.features.map(feature => ({
        ...feature,
        properties: {
          ...feature.properties,
          ...currentDataset.data[feature.properties.cca_2]
        }
      }))
    })
    this.setState({ mergedGeoJSON });
  }

  render() {
    if (!this.state.mergedGeoJSON) {
      return null;
    }

    return (
      <Suspense fallback={getFallbackComponent()}>
        <Source id="RKIdistrictAreas" type="geojson" data={this.state.mergedGeoJSON}>
          <Layer
            id="areas-fill"
            type="fill"
            paint={{
              'fill-color': {
                property: this.dataField,
                stops: [
                  [0, '#FFFFFF'],
                  [0.1, '#FED976'],
                  [0.2, '#FEB24C'],
                  [0.4, '#FFFFFF'],
                  [0.75, '#FC4E00'],
                  [1, '#E31A00'],
                  [1.2, '#BD0000'],
                  [1.4, '#800000'],
                ]
              },
              'fill-opacity': 0.8,
            }} />
          <Layer
            id="areas-borders"
            type="line"
            paint={{
              'line-color': '#627BC1',
              'line-width': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                4,
                0
              ]
            }} />
        </Source>
      </Suspense>
    )
  }
}

export const FeatureInfo = ({ feature, dataField }: FeatureInfoProps) => {
  return (
    <div>
      <div>PLZ: {feature.properties.name_2}</div>
      <div>Value: {feature.properties[dataField]}</div>
    </div>
  )
}
