# Install FolioPDF with APT

The signed FolioPDF repository provides the `amd64` Debian package for Ubuntu and other compatible Debian-based distributions.

Add the public signing key and source:

```sh
sudo install -d -m 0755 /etc/apt/keyrings
curl -fsSL https://debarkak.github.io/foliopdf/apt/foliopdf-archive-keyring.asc \
  | sudo tee /etc/apt/keyrings/foliopdf-archive-keyring.asc > /dev/null
echo 'deb [arch=amd64 signed-by=/etc/apt/keyrings/foliopdf-archive-keyring.asc] https://debarkak.github.io/foliopdf/apt stable main' \
  | sudo tee /etc/apt/sources.list.d/foliopdf.list
sudo apt update
sudo apt install folio-pdf
```

To update later:

```sh
sudo apt update
sudo apt install --only-upgrade folio-pdf
```

In **Settings → About & updates**, FolioPDF can check the signed release feed. When an update is available, the Debian package opens the [APT update instructions](https://debarkak.github.io/foliopdf/apt/) because package installation is handled by APT.

The APT signing key fingerprint is `5C5A 441A 00BE 0B34 A6E9 F145 2C68 04E1 5F8B A03C`.
