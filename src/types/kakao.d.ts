export {};

declare global {
  interface Window {
    kakao?: { maps: typeof kakao.maps };
  }

  namespace kakao.maps {
    function load(callback: () => void): void;

    class LatLng {
      constructor(latitude: number, longitude: number);
      getLat(): number;
      getLng(): number;
    }

    class LatLngBounds {
      constructor(southWest?: LatLng, northEast?: LatLng);
      getSouthWest(): LatLng;
      getNorthEast(): LatLng;
      contain(point: LatLng): boolean;
      extend(point: LatLng): void;
    }

    interface MapOptions {
      center: LatLng;
      level?: number;
      draggable?: boolean;
      scrollwheel?: boolean;
      disableDoubleClickZoom?: boolean;
      keyboardShortcuts?: boolean;
    }

    class Map {
      constructor(container: HTMLElement, options: MapOptions);
      getCenter(): LatLng;
      setCenter(center: LatLng): void;
      panTo(center: LatLng): void;
      getLevel(): number;
      setLevel(level: number, options?: { animate?: boolean; anchor?: LatLng }): void;
      getBounds(): LatLngBounds;
      setBounds(bounds: LatLngBounds): void;
      setMinLevel(level: number): void;
      setMaxLevel(level: number): void;
      relayout(): void;
      setDraggable(enabled: boolean): void;
      setZoomable(enabled: boolean): void;
      setKeyboardShortcuts(enabled: boolean): void;
      setCursor(cursor: string): void;
    }

    interface PolygonOptions {
      map?: Map;
      path?: LatLng[];
      strokeWeight?: number;
      strokeColor?: string;
      strokeOpacity?: number;
      strokeStyle?: string;
      fillColor?: string;
      fillOpacity?: number;
      zIndex?: number;
    }

    class Polygon {
      constructor(options: PolygonOptions);
      setMap(map: Map | null): void;
      setOptions(options: PolygonOptions): void;
      setZIndex(zIndex: number): void;
    }

    class CustomOverlay {
      constructor(options: {
        map?: Map;
        position: LatLng;
        content: HTMLElement | string;
        clickable?: boolean;
        xAnchor?: number;
        yAnchor?: number;
        zIndex?: number;
      });
      setMap(map: Map | null): void;
      setPosition(position: LatLng): void;
    }

    interface MouseEvent {
      latLng: LatLng;
    }

    namespace event {
      type Listener = (event: MouseEvent) => void;
      function addListener(target: object, type: string, callback: Listener): void;
      function removeListener(target: object, type: string, callback: Listener): void;
      function preventMap(): void;
    }

    namespace services {
      const Status: { OK: "OK"; ZERO_RESULT: "ZERO_RESULT"; ERROR: "ERROR" };
      type StatusValue = "OK" | "ZERO_RESULT" | "ERROR";

      interface PlaceResult {
        id: string;
        place_name: string;
        category_name: string;
        category_group_code: string;
        category_group_name: string;
        address_name: string;
        road_address_name: string;
        x: string;
        y: string;
        place_url: string;
        phone?: string;
        distance?: string;
      }

      interface RegionResult {
        region_type: "B" | "H";
        address_name: string;
        region_1depth_name: string;
        region_2depth_name: string;
        region_3depth_name: string;
        region_4depth_name?: string;
        code: string;
        x: number;
        y: number;
      }

      interface AddressResult {
        address_name: string;
        address_type: string;
        x: string;
        y: string;
        address?: { address_name: string } | null;
        road_address?: { address_name: string; building_name?: string } | null;
      }

      interface Pagination {
        current: number;
        first: number;
        last: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
        nextPage(): void;
        prevPage(): void;
        gotoPage(page: number): void;
      }

      interface SearchOptions {
        location?: LatLng;
        bounds?: LatLngBounds;
        radius?: number;
        size?: number;
        page?: number;
        useMapCenter?: boolean;
        useMapBounds?: boolean;
      }

      class Places {
        constructor(map?: Map);
        keywordSearch(keyword: string, callback: (results: PlaceResult[], status: StatusValue, pagination: Pagination) => void, options?: SearchOptions): void;
        categorySearch(category: string, callback: (results: PlaceResult[], status: StatusValue, pagination: Pagination) => void, options: SearchOptions): void;
      }

      class Geocoder {
        coord2RegionCode(longitude: number, latitude: number, callback: (results: RegionResult[], status: StatusValue) => void): void;
        addressSearch(address: string, callback: (results: AddressResult[], status: StatusValue, pagination: Pagination) => void, options?: { page?: number; size?: number }): void;
      }
    }
  }
}
