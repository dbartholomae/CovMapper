import { ReduxDispatch } from "../../useThunkDispatch";
import { AppApi } from "../app";
import { DefaultSearchOptions, CustomSearchOptions, SearchMethod, SearchResult, SearchResultList } from "../../app-config.types";
import { State } from "../";
import { FeatureCollection } from "geojson";

import { config } from "../../../app-config/index"


const locationFound = (query, data, properties, searchOptions?) => {
  const queryTransformed = searchOptions?.transformQuery 
    ? searchOptions?.transformQuery(query) 
    : query

  return properties.some(propName => {
    if (!data.properties[propName]) {
      console.warn(`Property "${propName}" not found in dataset, check your app-config search settings`)
      return false;
    }
    if (data.properties[propName].toLowerCase().includes(queryTransformed)) {
      return true;
    }
    return false;
  })
}

function defaultSearchMethod(query: string, state: State, searchOptions?: DefaultSearchOptions) {
  const { currentVisual, mappedSets } = state.app;
  const mappedSetsToSearchIn = searchOptions?.inMappings.map(mapping => ({
    ...mapping,
    data: mappedSets.get(currentVisual)?.get(mapping.id)
  }))

  if (!mappedSetsToSearchIn) {
    return { results: [] }
  }

  const foundResults: Array<SearchResult> = [];
  
  for (let setNum = 0; setNum < mappedSetsToSearchIn.length; setNum++){
    const currentSet = mappedSetsToSearchIn[setNum]
    const features = (currentSet.data?.geo as FeatureCollection).features

    for (let i = 0; i < features.length; i++){
      if (locationFound(query, features[i], currentSet.properties, searchOptions)){
        try {
          const coordinates = currentSet.getCoordinates(features[i])
          const props = features[i].properties || {}
          const name = props[searchOptions?.nameProp || 'name']

          foundResults.push({
            name,
            feature: features[i], 
            source: currentSet.id,
            lat: coordinates[1],
            lng: coordinates[0]
          });

        } catch(err) {
          console.log(err)
          console.warn('Coordinates extraction error, check your app-config search settings and geo data')
          return { results: [] }
        }
        break;
      } 
    }
  }

  return { results: foundResults }
}

export function switchViewToPlace(query, onFoundCallback, onErrorCallback) {
  return async (dispatch: ReduxDispatch, getState: () => State) => {
    const { default: FlyToInterpolator } = await import(/* webpackChunkName: "mapgl" */ 'react-map-gl/dist/es6/utils/transition/viewport-fly-to-interpolator')
    const state = getState();
    const { viewport, currentVisual } = state.app;
    const visual = config.visuals[currentVisual]
    const notFoundMessage = visual.search?.notFoundMessage
  
    let searchResult: SearchResultList 
    
    if (visual.search && (visual.search as CustomSearchOptions).searchMethod) {
      searchResult = await ((visual.search as CustomSearchOptions).searchMethod as SearchMethod)(query, state);
    } else {
      searchResult = await defaultSearchMethod(query, state, visual.search as DefaultSearchOptions);
    }

    if(searchResult.results.length === 1) {
      const result = searchResult.results[0];
      const latitude = result.lat
      const longitude = result.lng
      
      if (!latitude || !longitude) {
        dispatch(AppApi.setSnackbarMessage({ text: notFoundMessage || 'Nothing found.', type: 'error' }))
        return
      }

      const newViewport = {
        ...viewport,
        latitude, 
        longitude,
        zoom: 9.5,
        transitionDuration: 2500,
        transitionInterpolator: new FlyToInterpolator()
      };

      dispatch(AppApi.setViewport(newViewport));
      // TODO: find feature by coordinates and select on map
      if (result.feature) {
        dispatch(AppApi.setCurrentFeature(result.feature, [longitude, latitude]));
      }
      onFoundCallback()
    } else if (searchResult.results.length === 0) {
      onErrorCallback() 
      dispatch(AppApi.setSnackbarMessage({ text: notFoundMessage || '', type: 'error' }))
    } else {
      //Todo show multiple results
    }
  };
}
