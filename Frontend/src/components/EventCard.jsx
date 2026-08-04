import React from "react";
import { resolveImageUrl } from "../utils/imageUrl";

const EventCard = ({ event }) => {

  // format date into "21 Feb 2026"
  const formatDate = (dateString) => {
    if (!dateString) return "";

    const date = new Date(dateString);

    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="border rounded-lg shadow-md overflow-hidden">

      {/* Image */}
      <img
        src={resolveImageUrl(event.mainImage)}
        alt={event.title}
        className="w-full h-48 object-cover"
      />

      {/* Content */}
      <div className="p-4">

        {/* Title */}
        <h2 className="text-xl font-bold">{event.title}</h2>

        {/* Type */}
        <p className="text-gray-600">{event.type}</p>

        {/* Event Date */}
        {event.eventDate && (
          <p className="text-sm text-gray-700 mt-1">
            📅 {formatDate(event.eventDate)}
          </p>
        )}

        {/* Price */}
        <p className="mt-2 font-semibold">₹ {event.price}</p>

        {/* Location */}
        <p className="text-sm text-gray-500">{event.location}</p>

        {/* Dynamic sections */}
        {event.extraFields && event.extraFields.map((field, index) => (
          <div key={index} className="mt-2">
            <span className="font-semibold">{field.label}: </span>
            <span>{field.value}</span>
          </div>
        ))}

        {/* Contact */}
        <div className="mt-4">
          <p>📞 {event.phone}</p>
        </div>

      </div>
    </div>
  );
};

export default EventCard;
