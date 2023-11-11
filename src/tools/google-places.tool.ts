import Tool from "../tool.interface";
import { places } from "@googleapis/places";

const googlePlacesTool: Tool = {
    definition: {
        name: "google_places",
        description: "Search for places on google maps",
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "search query",
                },
            },
            required: ["query"],
        },
    },
    execute: async (parameters: any) => {
        const results = await places("v1").places.searchText({
            auth: process.env.GOOGLE_API_KEY,
            fields: '*',
            requestBody: {
                textQuery: parameters.query,
                maxResultCount: 5,
            }
        });
        const resultsFormatted = results.data.places?.map(place => {
                return {
                    name: place.name,
                    address: place.formattedAddress,
                    location: place.location,
                    rating: place.rating,
                    websiteUri: place.websiteUri,
                    openingHours: place.regularOpeningHours?.weekdayDescriptions,
                };
        });
        return JSON.stringify(resultsFormatted, null, 2);
    },
};

export default googlePlacesTool;
