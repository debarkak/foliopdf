#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "Usage: $0 <folio-pdf.deb> <repository-root> <version>" >&2
  exit 2
fi

deb_file=$(realpath -- "$1")
repository_root=$(realpath -m -- "$2")
version=$3
expected_fingerprint=${FOLIOPDF_APT_SIGNING_FINGERPRINT:?Set the repository signing key fingerprint}
passphrase_file=${FOLIOPDF_APT_PASSPHRASE_FILE:?Set the GPG passphrase file}

if [[ ! -f "$deb_file" || ! -f "$passphrase_file" ]]; then
  echo "The Debian package and GPG passphrase file must exist." >&2
  exit 1
fi
if [[ ! "$version" =~ ^[0-9][A-Za-z0-9.+:~_-]*$ ]]; then
  echo "Invalid Debian package version: $version" >&2
  exit 1
fi
if [[ "$(dpkg-deb -f "$deb_file" Package)" != "folio-pdf" || \
      "$(dpkg-deb -f "$deb_file" Version)" != "$version" || \
      "$(dpkg-deb -f "$deb_file" Architecture)" != "amd64" ]]; then
  echo "Expected a folio-pdf $version package for amd64." >&2
  exit 1
fi
if [[ "$repository_root" == "/" || "$repository_root" == "$deb_file" ]]; then
  echo "Refusing unsafe repository output path." >&2
  exit 1
fi

apt_root="$repository_root/apt"
rm -rf -- "$apt_root/dists/stable" "$apt_root/pool/main/f/folio-pdf"
mkdir -p "$apt_root/dists/stable/main/binary-amd64" "$apt_root/pool/main/f/folio-pdf"
cp -- "$deb_file" "$apt_root/pool/main/f/folio-pdf/folio-pdf_${version}_amd64.deb"

(
  cd "$apt_root"
  dpkg-scanpackages --arch amd64 pool /dev/null > dists/stable/main/binary-amd64/Packages
  gzip -9 -n -c dists/stable/main/binary-amd64/Packages > dists/stable/main/binary-amd64/Packages.gz
)

apt-ftparchive \
  -o APT::FTPArchive::Release::Origin="FolioPDF" \
  -o APT::FTPArchive::Release::Label="FolioPDF" \
  -o APT::FTPArchive::Release::Suite="stable" \
  -o APT::FTPArchive::Release::Codename="stable" \
  -o APT::FTPArchive::Release::Architectures="amd64" \
  -o APT::FTPArchive::Release::Components="main" \
  -o APT::FTPArchive::Release::Description="FolioPDF packages for Debian-based Linux distributions" \
  release "$apt_root/dists/stable" > "$apt_root/dists/stable/Release"

gpg --batch --list-secret-keys "${expected_fingerprint}!" >/dev/null
gpg --batch --yes --pinentry-mode loopback --passphrase-file "$passphrase_file" \
  --local-user "${expected_fingerprint}!" --clearsign \
  --output "$apt_root/dists/stable/InRelease" "$apt_root/dists/stable/Release"
gpg --batch --yes --pinentry-mode loopback --passphrase-file "$passphrase_file" \
  --local-user "${expected_fingerprint}!" --detach-sign \
  --output "$apt_root/dists/stable/Release.gpg" "$apt_root/dists/stable/Release"

echo "Built signed FolioPDF APT repository at $apt_root"
