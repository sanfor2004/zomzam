'use client';

import { useEffect } from 'react';
import { useMap } from '@vis.gl/react-google-maps';

interface MapBoundaryHighlightProps {
  placeId: string | null;
  layerType: string | null;
}

export const MapBoundaryHighlight = ({ placeId, layerType }: MapBoundaryHighlightProps) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    let isVectorMap = false;
    try {
      if (typeof (map as any).getRenderingType === 'function') {
        isVectorMap = (map as any).getRenderingType() === 'VECTOR';
      } else if ((map as any).renderingType) {
        isVectorMap = (map as any).renderingType === 'VECTOR';
      }
    } catch (err) {
      console.warn('[MapBoundaryHighlight] Error checking rendering capability:', err);
    }

    if (!isVectorMap) {
      return;
    }

    const layers = ['COUNTRY', 'ADMINISTRATIVE_AREA_LEVEL_1', 'ADMINISTRATIVE_AREA_LEVEL_2', 'LOCALITY', 'POSTAL_CODE'];
    
    const clearAllStyles = () => {
      layers.forEach(l => {
        try {
          const featureLayer = (map as any).getFeatureLayer(l);
          if (featureLayer) {
            featureLayer.style = null;
          }
        } catch (err) {
          // Feature layers may not be enabled
        }
      });
    };

    clearAllStyles();

    if (!placeId || !layerType) return;

    try {
      const featureLayer = (map as any).getFeatureLayer(layerType);
      if (featureLayer) {
        featureLayer.style = (options: any) => {
          if (options.feature.placeId === placeId) {
            return {
              fillColor: '#EE5712',
              fillOpacity: 0.15,
              strokeColor: '#EE5712',
              strokeOpacity: 0.8,
              strokeWeight: 2,
            };
          }
          return null;
        };
      }
    } catch (err) {
      console.warn(`[MapBoundaryHighlight] Failed to apply data-driven style to layer ${layerType}:`, err);
    }

    return () => {
      clearAllStyles();
    };
  }, [map, placeId, layerType]);

  return null;
};
