// lib/map.ts

export async function getRoute(fromLat: number, fromLon: number, toLat: number, toLon: number) {
    try {
        // Используем бесплатный сервер OSRM для построения маршрута
        const url = `http://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson`;
        
        const response = await fetch(url);
        const json = await response.json();

        if (json.routes && json.routes.length > 0) {
            const coordinates = json.routes[0].geometry.coordinates.map((c: number[]) => ({
                latitude: c[1],
                longitude: c[0],
            }));
            return coordinates;
        }
        return [];
    } catch (error) {
        console.log("Ошибка построения маршрута (OSRM):", error);
        return [];
    }
}