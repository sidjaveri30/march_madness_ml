import { memo, useEffect, useState } from "react";

import { getTeamInitials, getTeamLogoUrl } from "./teamMetadata";

function TeamLogo({ team, className = "", size = "md" }) {
  const [failed, setFailed] = useState(false);
  const logoUrl = getTeamLogoUrl(team);
  const showImage = Boolean(team && logoUrl && !failed);

  useEffect(() => {
    setFailed(false);
  }, [team, logoUrl]);

  if (showImage) {
    return (
      <img
        alt={`${team} logo`}
        className={`team-logo team-logo-${size} ${className}`.trim()}
        onError={() => setFailed(true)}
        src={logoUrl}
      />
    );
  }

  return (
    <span aria-label={team ? `${team} fallback mark` : "TBD fallback mark"} className={`team-logo-fallback team-logo-${size} ${className}`.trim()}>
      {getTeamInitials(team)}
    </span>
  );
}

export default memo(TeamLogo);
